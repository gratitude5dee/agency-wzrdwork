import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ServerAdapterModule } from "./types.js";
import { logger } from "../middleware/logger.js";
import {
  getAdapterPluginByType,
  getAdapterPluginsDir,
  listAdapterPlugins,
} from "../services/adapter-plugin-store.js";
import type { AdapterPluginRecord } from "../services/adapter-plugin-store.js";

const uiParserCache = new Map<string, string>();
const SUPPORTED_PARSER_CONTRACT = "1";
const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<unknown>;

function fileImportUrl(modulePath: string, cacheBust?: string): string {
  const url = pathToFileURL(modulePath);
  if (cacheBust) url.searchParams.set("t", cacheBust);
  return url.href;
}

async function importExternalModule(specifier: string): Promise<unknown> {
  try {
    return await nativeImport(specifier);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("dynamic import callback")) {
      throw err;
    }
    return await import(specifier);
  }
}

export function getUiParserSource(adapterType: string): string | undefined {
  return uiParserCache.get(adapterType);
}

export function getOrExtractUiParserSource(adapterType: string): string | undefined {
  const cached = uiParserCache.get(adapterType);
  if (cached) return cached;

  const record = getAdapterPluginByType(adapterType);
  if (!record) return undefined;

  const packageDir = resolvePackageDir(record);
  const source = extractUiParserSource(packageDir, record.packageName);
  if (source) {
    uiParserCache.set(adapterType, source);
    logger.info(
      { type: adapterType, packageName: record.packageName, origin: "lazy" },
      "UI parser extracted on-demand",
    );
  }
  return source;
}

function resolvePackageDir(record: Pick<AdapterPluginRecord, "localPath" | "packageName">): string {
  return record.localPath
    ? path.resolve(record.localPath)
    : path.resolve(getAdapterPluginsDir(), "node_modules", record.packageName);
}

function resolvePackageEntryPoint(packageDir: string): string {
  const pkgJsonPath = path.join(packageDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

  if (pkg.exports && typeof pkg.exports === "object" && pkg.exports["."]) {
    const exported = pkg.exports["."];
    return typeof exported === "string"
      ? exported
      : (exported.import ?? exported.default ?? "index.js");
  }
  return pkg.main ?? "index.js";
}

function extractUiParserSource(packageDir: string, packageName: string): string | undefined {
  const pkgJsonPath = path.join(packageDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));

  if (!pkg.exports || typeof pkg.exports !== "object" || !pkg.exports["./ui-parser"]) {
    return undefined;
  }

  const contractVersion = pkg.paperclip?.adapterUiParser;
  if (contractVersion) {
    const major = String(contractVersion).split(".")[0];
    if (major !== SUPPORTED_PARSER_CONTRACT) {
      logger.warn(
        { packageName, contractVersion, supported: `${SUPPORTED_PARSER_CONTRACT}.x` },
        "Adapter declares unsupported UI parser contract version; skipping UI parser",
      );
      return undefined;
    }
  }

  const uiParserExport = pkg.exports["./ui-parser"];
  const uiParserFile = typeof uiParserExport === "string"
    ? uiParserExport
    : (uiParserExport.import ?? uiParserExport.default);
  if (typeof uiParserFile !== "string" || uiParserFile.trim().length === 0) {
    return undefined;
  }

  const uiParserPath = path.resolve(packageDir, uiParserFile);
  if (!uiParserPath.startsWith(packageDir + path.sep) && uiParserPath !== packageDir) {
    logger.warn({ packageName, uiParserFile }, "UI parser path escapes package directory; skipping");
    return undefined;
  }

  if (!fs.existsSync(uiParserPath)) {
    return undefined;
  }

  try {
    const source = fs.readFileSync(uiParserPath, "utf-8");
    logger.info(
      { packageName, uiParserFile, size: source.length },
      "Loaded UI parser from adapter package",
    );
    return source;
  } catch (err) {
    logger.warn({ err, packageName, uiParserFile }, "Failed to read UI parser from adapter package");
    return undefined;
  }
}

function validateAdapterModule(mod: unknown, packageName: string): ServerAdapterModule {
  const createServerAdapter = (mod as Record<string, unknown>).createServerAdapter;
  if (typeof createServerAdapter !== "function") {
    throw new Error(
      `Package "${packageName}" does not export createServerAdapter(). ` +
      "Ensure the package main entry exports a createServerAdapter function.",
    );
  }

  const adapterModule = createServerAdapter() as ServerAdapterModule;
  if (!adapterModule || typeof adapterModule.type !== "string" || adapterModule.type.trim().length === 0) {
    throw new Error(
      `createServerAdapter() from "${packageName}" returned an invalid module (missing "type").`,
    );
  }
  return adapterModule;
}

export async function loadExternalAdapterPackage(
  packageName: string,
  localPath?: string,
): Promise<ServerAdapterModule> {
  const packageDir = localPath
    ? path.resolve(localPath)
    : path.resolve(getAdapterPluginsDir(), "node_modules", packageName);

  const entryPoint = resolvePackageEntryPoint(packageDir);
  const modulePath = path.resolve(packageDir, entryPoint);
  const uiParserSource = extractUiParserSource(packageDir, packageName);

  logger.info(
    { packageName, packageDir, entryPoint, modulePath, hasUiParser: !!uiParserSource },
    "Loading external adapter package",
  );

  const mod = await importExternalModule(fileImportUrl(modulePath));
  const adapterModule = validateAdapterModule(mod, packageName);

  if (uiParserSource) {
    uiParserCache.set(adapterModule.type, uiParserSource);
  }

  return adapterModule;
}

async function loadFromRecord(record: AdapterPluginRecord): Promise<ServerAdapterModule | null> {
  try {
    return await loadExternalAdapterPackage(record.packageName, record.localPath);
  } catch (err) {
    logger.warn(
      { err, packageName: record.packageName, type: record.type },
      "Failed to dynamically load external adapter; skipping",
    );
    return null;
  }
}

export async function reloadExternalAdapter(type: string): Promise<ServerAdapterModule | null> {
  const record = getAdapterPluginByType(type);
  if (!record) return null;

  const packageDir = resolvePackageDir(record);
  const entryPoint = resolvePackageEntryPoint(packageDir);
  const modulePath = path.resolve(packageDir, entryPoint);
  const fileUrl = fileImportUrl(modulePath);

  try {
    const bunCache = (globalThis as typeof globalThis & { Bun?: { __moduleCache?: Map<string, unknown> } })
      .Bun?.__moduleCache;
    bunCache?.delete(fileUrl);
    bunCache?.delete(modulePath);
  } catch {
    // The cache-busted file URL below is enough for Node.
  }

  const cacheBustUrl = fileImportUrl(modulePath, `${Date.now()}`);
  logger.info(
    { type, packageName: record.packageName, modulePath, cacheBustUrl },
    "Reloading external adapter",
  );

  const mod = await importExternalModule(cacheBustUrl);
  const adapterModule = validateAdapterModule(mod, record.packageName);

  uiParserCache.delete(type);
  const uiParserSource = extractUiParserSource(packageDir, record.packageName);
  if (uiParserSource) {
    uiParserCache.set(adapterModule.type, uiParserSource);
  }

  logger.info(
    { type, packageName: record.packageName, hasUiParser: !!uiParserSource },
    "Successfully reloaded external adapter",
  );

  return adapterModule;
}

export async function buildExternalAdapters(): Promise<ServerAdapterModule[]> {
  const results: ServerAdapterModule[] = [];

  for (const record of listAdapterPlugins()) {
    const adapter = await loadFromRecord(record);
    if (adapter) results.push(adapter);
  }

  if (results.length > 0) {
    logger.info(
      { count: results.length, adapters: results.map((adapter) => adapter.type) },
      "Loaded external adapters from plugin store",
    );
  }

  return results;
}
