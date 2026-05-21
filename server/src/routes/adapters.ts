import { execFile } from "node:child_process";
import fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { Router } from "express";
import type { AdapterConfigSchema, ServerAdapterModule } from "../adapters/types.js";
import { BUILTIN_ADAPTER_TYPES } from "../adapters/builtin-adapter-types.js";
import {
  findActiveServerAdapter,
  findServerAdapter,
  isOverridePaused,
  listServerAdapters,
  registerServerAdapter,
  resolveExternalAdapterRegistration,
  setOverridePaused,
  unregisterServerAdapter,
} from "../adapters/registry.js";
import {
  getOrExtractUiParserSource,
  loadExternalAdapterPackage,
  reloadExternalAdapter,
} from "../adapters/plugin-loader.js";
import { logger } from "../middleware/logger.js";
import {
  addAdapterPlugin,
  getAdapterPluginByType,
  getAdapterPluginsDir,
  getDisabledAdapterTypes,
  listAdapterPlugins,
  removeAdapterPlugin,
  setAdapterDisabled,
} from "../services/adapter-plugin-store.js";
import type { AdapterPluginRecord } from "../services/adapter-plugin-store.js";
import { assertBoardOrgAccess, assertInstanceAdmin } from "./authz.js";

const execFileAsync = promisify(execFile);

interface AdapterInstallRequest {
  packageName: string;
  isLocalPath?: boolean;
  version?: string;
}

interface AdapterCapabilities {
  supportsInstructionsBundle: boolean;
  supportsSkills: boolean;
  supportsLocalAgentJwt: boolean;
  requiresMaterializedRuntimeSkills: boolean;
  supportsModelProfiles: boolean;
}

interface AdapterInfo {
  type: string;
  label: string;
  source: "builtin" | "external";
  modelsCount: number;
  loaded: boolean;
  disabled: boolean;
  capabilities: AdapterCapabilities;
  overriddenBuiltin?: boolean;
  overridePaused?: boolean;
  version?: string;
  packageName?: string;
  isLocalPath?: boolean;
}

function resolveAdapterPackageDir(record: AdapterPluginRecord): string {
  return record.localPath
    ? path.resolve(record.localPath)
    : path.resolve(getAdapterPluginsDir(), "node_modules", record.packageName);
}

function readAdapterPackageVersionFromDisk(record: AdapterPluginRecord): string | undefined {
  try {
    const raw = fs.readFileSync(path.join(resolveAdapterPackageDir(record), "package.json"), "utf-8");
    const version = JSON.parse(raw).version;
    return typeof version === "string" && version.trim().length > 0 ? version.trim() : undefined;
  } catch {
    return undefined;
  }
}

function buildAdapterCapabilities(adapter: ServerAdapterModule): AdapterCapabilities {
  return {
    supportsInstructionsBundle: adapter.supportsInstructionsBundle ?? false,
    supportsSkills: Boolean(adapter.listSkills || adapter.syncSkills),
    supportsLocalAgentJwt: adapter.supportsLocalAgentJwt ?? false,
    requiresMaterializedRuntimeSkills: adapter.requiresMaterializedRuntimeSkills ?? false,
    supportsModelProfiles: Boolean(adapter.modelProfiles?.length || adapter.listModelProfiles),
  };
}

function buildAdapterInfo(
  adapter: ServerAdapterModule,
  externalRecord: AdapterPluginRecord | undefined,
  disabledSet: Set<string>,
): AdapterInfo {
  const diskVersion = externalRecord ? readAdapterPackageVersionFromDisk(externalRecord) : undefined;
  return {
    type: adapter.type,
    label: adapter.type,
    source: externalRecord ? "external" : "builtin",
    modelsCount: (adapter.models ?? []).length,
    loaded: true,
    disabled: disabledSet.has(adapter.type),
    capabilities: buildAdapterCapabilities(adapter),
    overriddenBuiltin: externalRecord ? BUILTIN_ADAPTER_TYPES.has(adapter.type) : undefined,
    overridePaused: BUILTIN_ADAPTER_TYPES.has(adapter.type) ? isOverridePaused(adapter.type) : undefined,
    version: diskVersion ?? externalRecord?.version,
    packageName: externalRecord?.packageName,
    isLocalPath: externalRecord?.localPath ? true : undefined,
  };
}

async function normalizeLocalPath(rawPath: string): Promise<string> {
  if (rawPath.startsWith("/")) return rawPath;

  if (/^[A-Za-z]:[\\/]/.test(rawPath)) {
    try {
      const { stdout } = await execFileAsync("wslpath", ["-u", rawPath]);
      return stdout.trim();
    } catch (err) {
      logger.warn({ err, rawPath }, "wslpath conversion failed; using path as-is");
      return rawPath;
    }
  }

  return rawPath;
}

function registerWithSessionManagement(adapter: ServerAdapterModule): void {
  registerServerAdapter(resolveExternalAdapterRegistration(adapter));
}

export function adapterRoutes() {
  const router = Router();
  const configSchemaCache = new Map<string, {
    adapter: ServerAdapterModule;
    schema: AdapterConfigSchema;
    fetchedAt: number;
  }>();
  const CONFIG_SCHEMA_TTL_MS = 30_000;

  router.get("/adapters", async (req, res) => {
    assertBoardOrgAccess(req);
    const externalRecords = new Map(listAdapterPlugins().map((record) => [record.type, record]));
    const disabledSet = new Set(getDisabledAdapterTypes());
    const result = listServerAdapters()
      .map((adapter) => buildAdapterInfo(adapter, externalRecords.get(adapter.type), disabledSet))
      .sort((a, b) => a.type.localeCompare(b.type));
    res.json(result);
  });

  router.post("/adapters/install", async (req, res) => {
    assertInstanceAdmin(req);
    const { packageName, isLocalPath = false, version } = req.body as AdapterInstallRequest;

    if (!packageName || typeof packageName !== "string") {
      res.status(400).json({ error: "packageName is required and must be a string." });
      return;
    }

    let canonicalName = packageName;
    let explicitVersion = version;
    const versionSuffix = packageName.match(/@(\d+\.\d+\.\d+.*)$/);
    if (versionSuffix) {
      const lastAtIndex = packageName.lastIndexOf("@");
      if (lastAtIndex > 0 && !explicitVersion) {
        canonicalName = packageName.slice(0, lastAtIndex);
        explicitVersion = versionSuffix[1];
      }
    }

    try {
      let installedVersion: string | undefined;
      let moduleLocalPath: string | undefined;

      if (!isLocalPath) {
        const pluginsDir = getAdapterPluginsDir();
        const spec = explicitVersion ? `${canonicalName}@${explicitVersion}` : canonicalName;

        logger.info({ spec, pluginsDir }, "Installing adapter package via npm");
        await execFileAsync("npm", ["install", "--no-save", spec], {
          cwd: pluginsDir,
          timeout: 120_000,
        });

        try {
          const pkgRaw = await readFile(
            path.join(pluginsDir, "node_modules", canonicalName, "package.json"),
            "utf-8",
          );
          const packageVersion = JSON.parse(pkgRaw).version;
          installedVersion =
            typeof packageVersion === "string" && packageVersion.trim().length > 0
              ? packageVersion.trim()
              : explicitVersion;
        } catch {
          installedVersion = explicitVersion;
        }
      } else {
        moduleLocalPath = path.resolve(await normalizeLocalPath(packageName));
        try {
          const pkgRaw = await readFile(path.join(moduleLocalPath, "package.json"), "utf-8");
          const packageVersion = JSON.parse(pkgRaw).version;
          if (typeof packageVersion === "string" && packageVersion.trim().length > 0) {
            installedVersion = packageVersion.trim();
          }
        } catch {
          installedVersion = explicitVersion;
        }
      }

      const adapterModule = await loadExternalAdapterPackage(canonicalName, moduleLocalPath);
      if (BUILTIN_ADAPTER_TYPES.has(adapterModule.type)) {
        res.status(409).json({
          error: `Adapter type "${adapterModule.type}" is a built-in adapter and cannot be overwritten.`,
        });
        return;
      }

      const isReinstall = findServerAdapter(adapterModule.type) !== null;
      if (isReinstall) {
        unregisterServerAdapter(adapterModule.type);
        logger.info({ type: adapterModule.type }, "Unregistered existing adapter for replacement");
      }

      registerWithSessionManagement(adapterModule);
      configSchemaCache.delete(adapterModule.type);

      const record: AdapterPluginRecord = {
        packageName: canonicalName,
        localPath: moduleLocalPath,
        version: installedVersion ?? explicitVersion,
        type: adapterModule.type,
        installedAt: new Date().toISOString(),
      };
      addAdapterPlugin(record);

      logger.info(
        { type: adapterModule.type, packageName: canonicalName },
        "External adapter installed and registered",
      );

      res.status(201).json({
        type: adapterModule.type,
        packageName: canonicalName,
        version: installedVersion ?? explicitVersion,
        installedAt: record.installedAt,
        requiresRestart: isReinstall,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, packageName }, "Failed to install external adapter");
      if (message.includes("npm") || message.includes("ERR!")) {
        res.status(500).json({ error: `npm install failed: ${message}` });
      } else {
        res.status(500).json({ error: `Failed to install adapter: ${message}` });
      }
    }
  });

  router.patch("/adapters/:type", async (req, res) => {
    assertInstanceAdmin(req);
    const adapterType = req.params.type as string;
    const { disabled } = req.body as { disabled?: boolean };
    if (typeof disabled !== "boolean") {
      res.status(400).json({ error: "Request body must include { \"disabled\": true|false }." });
      return;
    }
    const existing = findServerAdapter(adapterType);
    if (!existing) {
      res.status(404).json({ error: `Adapter "${adapterType}" is not registered.` });
      return;
    }
    const changed = setAdapterDisabled(adapterType, disabled);
    if (changed) logger.info({ type: adapterType, disabled }, "Adapter enabled/disabled");
    res.json({ type: adapterType, disabled, changed });
  });

  router.patch("/adapters/:type/override", async (req, res) => {
    assertInstanceAdmin(req);
    const adapterType = req.params.type as string;
    const { paused } = req.body as { paused?: boolean };
    if (typeof paused !== "boolean") {
      res.status(400).json({ error: "\"paused\" (boolean) is required in request body." });
      return;
    }
    if (!BUILTIN_ADAPTER_TYPES.has(adapterType)) {
      res.status(400).json({ error: `Type "${adapterType}" is not a builtin adapter.` });
      return;
    }
    const changed = setOverridePaused(adapterType, paused);
    logger.info({ type: adapterType, paused, changed }, "Adapter override toggle");
    res.json({ type: adapterType, paused, changed });
  });

  router.delete("/adapters/:type", async (req, res) => {
    assertInstanceAdmin(req);
    const adapterType = req.params.type as string;

    if (BUILTIN_ADAPTER_TYPES.has(adapterType)) {
      res.status(403).json({ error: `Cannot remove built-in adapter "${adapterType}".` });
      return;
    }

    const existing = findServerAdapter(adapterType);
    if (!existing) {
      res.status(404).json({ error: `Adapter "${adapterType}" is not registered.` });
      return;
    }

    const externalRecord = getAdapterPluginByType(adapterType);
    if (!externalRecord) {
      res.status(404).json({ error: `Adapter "${adapterType}" is not an externally installed adapter.` });
      return;
    }

    if (externalRecord.packageName && !externalRecord.localPath) {
      try {
        await execFileAsync("npm", ["uninstall", externalRecord.packageName], {
          cwd: getAdapterPluginsDir(),
          timeout: 60_000,
        });
        logger.info(
          { type: adapterType, packageName: externalRecord.packageName },
          "npm uninstall completed for external adapter",
        );
      } catch (err) {
        logger.warn(
          { err, type: adapterType, packageName: externalRecord.packageName },
          "npm uninstall failed for external adapter; continuing with unregister",
        );
      }
    }

    unregisterServerAdapter(adapterType);
    removeAdapterPlugin(adapterType);
    configSchemaCache.delete(adapterType);
    logger.info({ type: adapterType }, "External adapter unregistered and removed");
    res.json({ type: adapterType, removed: true });
  });

  router.post("/adapters/:type/reload", async (req, res) => {
    assertInstanceAdmin(req);
    const type = req.params.type as string;

    if (BUILTIN_ADAPTER_TYPES.has(type) && !getAdapterPluginByType(type)) {
      res.status(400).json({ error: "Cannot reload built-in adapter." });
      return;
    }

    try {
      const newModule = await reloadExternalAdapter(type);
      if (!newModule) {
        res.status(404).json({ error: `Adapter "${type}" is not an externally installed adapter.` });
        return;
      }

      unregisterServerAdapter(type);
      registerWithSessionManagement(newModule);
      configSchemaCache.delete(type);

      const record = getAdapterPluginByType(type);
      let newVersion: string | undefined;
      if (record) {
        newVersion = readAdapterPackageVersionFromDisk(record);
        if (newVersion) addAdapterPlugin({ ...record, version: newVersion });
      }

      logger.info({ type, version: newVersion }, "External adapter reloaded at runtime");
      res.json({ type, version: newVersion, reloaded: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, type }, "Failed to reload external adapter");
      res.status(500).json({ error: `Failed to reload adapter: ${message}` });
    }
  });

  router.post("/adapters/:type/reinstall", async (req, res) => {
    assertInstanceAdmin(req);
    const type = req.params.type as string;

    if (BUILTIN_ADAPTER_TYPES.has(type) && !getAdapterPluginByType(type)) {
      res.status(400).json({ error: "Cannot reinstall built-in adapter." });
      return;
    }

    const record = getAdapterPluginByType(type);
    if (!record) {
      res.status(404).json({ error: `Adapter "${type}" is not an externally installed adapter.` });
      return;
    }
    if (record.localPath) {
      res.status(400).json({ error: "Local-path adapters cannot be reinstalled. Use Reload instead." });
      return;
    }

    try {
      logger.info({ type, packageName: record.packageName }, "Reinstalling adapter package via npm");
      await execFileAsync("npm", ["install", "--no-save", record.packageName], {
        cwd: getAdapterPluginsDir(),
        timeout: 120_000,
      });

      const newModule = await reloadExternalAdapter(type);
      if (!newModule) {
        res.status(500).json({ error: "npm install succeeded but adapter reload failed." });
        return;
      }

      unregisterServerAdapter(type);
      registerWithSessionManagement(newModule);
      configSchemaCache.delete(type);

      const updatedRecord = getAdapterPluginByType(type);
      let newVersion: string | undefined;
      if (updatedRecord) {
        newVersion = readAdapterPackageVersionFromDisk(updatedRecord);
        if (newVersion) addAdapterPlugin({ ...updatedRecord, version: newVersion });
      }

      logger.info({ type, version: newVersion }, "Adapter reinstalled from npm");
      res.json({ type, version: newVersion, reinstalled: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, type }, "Failed to reinstall adapter");
      res.status(500).json({ error: `Reinstall failed: ${message}` });
    }
  });

  router.get("/adapters/:type/config-schema", async (req, res) => {
    assertBoardOrgAccess(req);
    const type = req.params.type as string;
    const adapter = findActiveServerAdapter(type);
    if (!adapter) {
      res.status(404).json({ error: `Adapter "${type}" is not registered.` });
      return;
    }
    if (!adapter.getConfigSchema) {
      res.json({
        type: adapter.type,
        schema: null,
        agentConfigurationDoc: adapter.agentConfigurationDoc ?? null,
      });
      return;
    }

    const cached = configSchemaCache.get(type);
    if (cached && cached.adapter === adapter && Date.now() - cached.fetchedAt < CONFIG_SCHEMA_TTL_MS) {
      res.json(cached.schema);
      return;
    }

    try {
      const schema = await adapter.getConfigSchema();
      configSchemaCache.set(type, { adapter, schema, fetchedAt: Date.now() });
      res.json(schema);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, type }, "Failed to resolve config schema");
      res.status(500).json({ error: `Failed to resolve config schema: ${message}` });
    }
  });

  router.get("/adapters/:type/ui-parser.js", (req, res) => {
    assertBoardOrgAccess(req);
    const type = req.params.type as string;
    const source = getOrExtractUiParserSource(type);
    if (!source) {
      res.status(404).json({ error: `No UI parser available for adapter "${type}".` });
      return;
    }
    res.type("application/javascript").send(source);
  });

  return router;
}
