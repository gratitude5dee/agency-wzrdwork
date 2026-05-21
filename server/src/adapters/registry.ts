import type { AdapterModel, ServerAdapterModule } from "./types.js";
import { getAdapterSessionManagement } from "@paperclipai/adapter-utils";
import { listCodexModels } from "./codex-models.js";
import { listCursorModels } from "./cursor-models.js";
import { processAdapter } from "./process/index.js";
import { httpAdapter } from "./http/index.js";
import { BUILTIN_ADAPTER_TYPES } from "./builtin-adapter-types.js";
import { buildExternalAdapters } from "./plugin-loader.js";
import { getDisabledAdapterTypes } from "../services/adapter-plugin-store.js";

type BuiltinAdapterDefinition = {
  type: string;
  packageName: string;
  supportsLocalAgentJwt: boolean;
  supportsInstructionsBundle?: boolean;
  instructionsPathKey?: string;
  requiresMaterializedRuntimeSkills?: boolean;
  runtimeCommandFallback?: string;
  listModels?: () => Promise<AdapterModel[]>;
  listAcpxModels?: boolean;
};

const BUILTIN_ADAPTER_DEFINITIONS: BuiltinAdapterDefinition[] = [
  {
    type: "acpx_local",
    packageName: "@paperclipai/adapter-acpx-local",
    supportsLocalAgentJwt: true,
    supportsInstructionsBundle: true,
    instructionsPathKey: "instructionsFilePath",
    requiresMaterializedRuntimeSkills: false,
    listAcpxModels: true,
  },
  {
    type: "claude_local",
    packageName: "@paperclipai/adapter-claude-local",
    supportsLocalAgentJwt: true,
  },
  {
    type: "codex_local",
    packageName: "@paperclipai/adapter-codex-local",
    supportsLocalAgentJwt: true,
    listModels: listCodexModels,
  },
  {
    type: "opencode_local",
    packageName: "@paperclipai/adapter-opencode-local",
    supportsLocalAgentJwt: true,
  },
  {
    type: "pi_local",
    packageName: "@paperclipai/adapter-pi-local",
    supportsLocalAgentJwt: true,
  },
  {
    type: "cursor",
    packageName: "@paperclipai/adapter-cursor-local",
    supportsLocalAgentJwt: true,
    listModels: listCursorModels,
  },
  {
    type: "cursor_cloud",
    packageName: "@paperclipai/adapter-cursor-cloud",
    supportsLocalAgentJwt: false,
    supportsInstructionsBundle: true,
    instructionsPathKey: "instructionsFilePath",
    requiresMaterializedRuntimeSkills: false,
  },
  {
    type: "gemini_local",
    packageName: "@paperclipai/adapter-gemini-local",
    supportsLocalAgentJwt: true,
  },
  {
    type: "grok_local",
    packageName: "@paperclipai/adapter-grok-local",
    supportsLocalAgentJwt: true,
    supportsInstructionsBundle: true,
    instructionsPathKey: "instructionsFilePath",
    requiresMaterializedRuntimeSkills: true,
    runtimeCommandFallback: "grok",
  },
  {
    type: "openclaw_gateway",
    packageName: "@paperclipai/adapter-openclaw-gateway",
    supportsLocalAgentJwt: false,
  },
  {
    type: "hermes_local",
    packageName: "hermes-paperclip-adapter",
    supportsLocalAgentJwt: true,
  },
];

const builtinDefinitionsByType = new Map(BUILTIN_ADAPTER_DEFINITIONS.map((definition) => [definition.type, definition]));
const loadedBuiltinAdapters = new Map<string, Promise<ServerAdapterModule>>();

function readConfiguredCommand(config: Record<string, unknown>, fallback: string): string {
  const value = typeof config.command === "string" ? config.command.trim() : "";
  return value.length > 0 ? value : fallback;
}

function dedupeAdapterModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const result: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({ ...model, id, label: model.label.trim() || id });
  }
  return result;
}

function prefixAdapterModelLabels(models: AdapterModel[], provider: "Claude" | "Codex"): AdapterModel[] {
  const prefix = `${provider}: `;
  return models.map((model) => ({
    ...model,
    label: model.label.startsWith(prefix) ? model.label : `${prefix}${model.label}`,
  }));
}

function readModels(module: unknown): AdapterModel[] {
  const models = (module as { models?: AdapterModel[] }).models;
  return Array.isArray(models) ? dedupeAdapterModels(models) : [];
}

function dynamicImport(specifier: string): Promise<Record<string, unknown>> {
  return import(specifier) as Promise<Record<string, unknown>>;
}

async function importAdapterRoot(packageName: string): Promise<Record<string, unknown>> {
  return dynamicImport(packageName);
}

async function importAdapterServer(packageName: string): Promise<Record<string, unknown>> {
  return dynamicImport(`${packageName}/server`);
}

async function listAcpxModels(): Promise<AdapterModel[]> {
  const [acpxRoot, claudeRoot, codexRoot] = await Promise.all([
    importAdapterRoot("@paperclipai/adapter-acpx-local"),
    importAdapterRoot("@paperclipai/adapter-claude-local"),
    importAdapterRoot("@paperclipai/adapter-codex-local"),
  ]);
  const codex = await listCodexModels().catch(() => readModels(codexRoot));
  return dedupeAdapterModels([
    ...readModels(acpxRoot),
    ...prefixAdapterModelLabels(readModels(claudeRoot), "Claude"),
    ...prefixAdapterModelLabels(codex, "Codex"),
  ]);
}

function requiredFunction<T extends (...args: any[]) => any>(
  module: Record<string, unknown>,
  name: string,
  adapterType: string,
): T {
  const value = module[name];
  if (typeof value !== "function") {
    throw new Error(`Adapter "${adapterType}" does not export ${name}().`);
  }
  return value as T;
}

async function buildBuiltinAdapter(definition: BuiltinAdapterDefinition): Promise<ServerAdapterModule> {
  const [serverModule, rootModule] = await Promise.all([
    importAdapterServer(definition.packageName),
    importAdapterRoot(definition.packageName),
  ]);

  const adapter: ServerAdapterModule = {
    type: definition.type,
    execute: requiredFunction(serverModule, "execute", definition.type),
    testEnvironment: requiredFunction(serverModule, "testEnvironment", definition.type),
    sessionCodec: serverModule.sessionCodec as ServerAdapterModule["sessionCodec"],
    sessionManagement: getAdapterSessionManagement(definition.type) ?? undefined,
    models: readModels(rootModule),
    supportsLocalAgentJwt: definition.supportsLocalAgentJwt,
    supportsInstructionsBundle: definition.supportsInstructionsBundle,
    instructionsPathKey: definition.instructionsPathKey,
    requiresMaterializedRuntimeSkills: definition.requiresMaterializedRuntimeSkills,
    agentConfigurationDoc:
      typeof rootModule.agentConfigurationDoc === "string" ? rootModule.agentConfigurationDoc : undefined,
    listSkills:
      typeof serverModule.listAcpxSkills === "function"
        ? (serverModule.listAcpxSkills as ServerAdapterModule["listSkills"])
        : typeof serverModule.listGrokSkills === "function"
          ? (serverModule.listGrokSkills as ServerAdapterModule["listSkills"])
          : undefined,
    syncSkills:
      typeof serverModule.syncAcpxSkills === "function"
        ? (serverModule.syncAcpxSkills as ServerAdapterModule["syncSkills"])
        : typeof serverModule.syncGrokSkills === "function"
          ? (serverModule.syncGrokSkills as ServerAdapterModule["syncSkills"])
          : undefined,
    getConfigSchema:
      typeof serverModule.getConfigSchema === "function"
        ? (serverModule.getConfigSchema as ServerAdapterModule["getConfigSchema"])
        : undefined,
    getQuotaWindows:
      typeof serverModule.getQuotaWindows === "function"
        ? (serverModule.getQuotaWindows as ServerAdapterModule["getQuotaWindows"])
        : undefined,
  };

  if (definition.listAcpxModels) {
    adapter.listModels = listAcpxModels;
  } else if (definition.listModels) {
    adapter.listModels = definition.listModels;
  } else if (typeof serverModule.listOpenCodeModels === "function") {
    adapter.listModels = serverModule.listOpenCodeModels as ServerAdapterModule["listModels"];
  } else if (typeof serverModule.listPiModels === "function") {
    adapter.listModels = serverModule.listPiModels as ServerAdapterModule["listModels"];
  }

  if (definition.runtimeCommandFallback) {
    adapter.getRuntimeCommandSpec = (config) => ({
      command: readConfiguredCommand(config, definition.runtimeCommandFallback!),
      detectCommand: readConfiguredCommand(config, definition.runtimeCommandFallback!),
      installCommand: null,
    });
  }

  adaptersByType.set(definition.type, adapter);
  return adapter;
}

function loadBuiltinAdapter(type: string): Promise<ServerAdapterModule> {
  const definition = builtinDefinitionsByType.get(type);
  if (!definition) {
    return Promise.reject(new Error(`Unknown built-in adapter "${type}".`));
  }

  const existing = loadedBuiltinAdapters.get(type);
  if (existing) return existing;

  const loading = buildBuiltinAdapter(definition);
  loadedBuiltinAdapters.set(type, loading);
  return loading;
}

function makeLazyBuiltinAdapter(definition: BuiltinAdapterDefinition): ServerAdapterModule {
  const adapter: ServerAdapterModule = {
    type: definition.type,
    models: [],
    sessionManagement: getAdapterSessionManagement(definition.type) ?? undefined,
    supportsLocalAgentJwt: definition.supportsLocalAgentJwt,
    supportsInstructionsBundle: definition.supportsInstructionsBundle,
    instructionsPathKey: definition.instructionsPathKey,
    requiresMaterializedRuntimeSkills: definition.requiresMaterializedRuntimeSkills,
    execute: async (ctx) => (await loadBuiltinAdapter(definition.type)).execute(ctx),
    testEnvironment: async (ctx) => (await loadBuiltinAdapter(definition.type)).testEnvironment(ctx),
    listModels: async () => {
      const loaded = await loadBuiltinAdapter(definition.type);
      if (loaded.listModels) return loaded.listModels();
      return loaded.models ?? [];
    },
    getConfigSchema: async () => {
      const loaded = await loadBuiltinAdapter(definition.type);
      if (!loaded.getConfigSchema) return { fields: [] };
      return loaded.getConfigSchema();
    },
    getQuotaWindows: async () => {
      const loaded = await loadBuiltinAdapter(definition.type);
      if (!loaded.getQuotaWindows) {
        return {
          provider: definition.type,
          ok: false,
          error: "Adapter does not expose quota windows.",
          windows: [],
        };
      }
      return loaded.getQuotaWindows();
    },
  };

  if (definition.supportsInstructionsBundle) {
    adapter.listSkills = async (ctx) => {
      const loaded = await loadBuiltinAdapter(definition.type);
      if (!loaded.listSkills) {
        return {
          adapterType: definition.type,
          supported: false,
          mode: "unsupported",
          desiredSkills: [],
          entries: [],
          warnings: ["Adapter does not expose skill synchronization."],
        };
      }
      return loaded.listSkills(ctx);
    };
    adapter.syncSkills = async (ctx, desiredSkills) => {
      const loaded = await loadBuiltinAdapter(definition.type);
      if (!loaded.syncSkills) {
        return {
          adapterType: definition.type,
          supported: false,
          mode: "unsupported",
          desiredSkills,
          entries: [],
          warnings: ["Adapter does not expose skill synchronization."],
        };
      }
      return loaded.syncSkills(ctx, desiredSkills);
    };
  }

  if (definition.runtimeCommandFallback) {
    adapter.getRuntimeCommandSpec = (config) => ({
      command: readConfiguredCommand(config, definition.runtimeCommandFallback!),
      detectCommand: readConfiguredCommand(config, definition.runtimeCommandFallback!),
      installCommand: null,
    });
  }

  return adapter;
}

const adaptersByType = new Map<string, ServerAdapterModule>(
  [
    ...BUILTIN_ADAPTER_DEFINITIONS.map(makeLazyBuiltinAdapter),
    processAdapter,
    httpAdapter,
  ].map((a) => [a.type, a]),
);

const builtinFallbacks = new Map<string, ServerAdapterModule>();
const pausedOverrideTypes = new Set<string>();

function getDisabledAdapterTypeSet() {
  return new Set(getDisabledAdapterTypes());
}

export function resolveExternalAdapterRegistration(externalAdapter: ServerAdapterModule): ServerAdapterModule {
  return {
    ...externalAdapter,
    sessionManagement:
      externalAdapter.sessionManagement
      ?? getAdapterSessionManagement(externalAdapter.type)
      ?? undefined,
  };
}

const externalAdaptersReady: Promise<void> = (async () => {
  try {
    const externalAdapters = await buildExternalAdapters();
    for (const externalAdapter of externalAdapters) {
      const overridingBuiltin = BUILTIN_ADAPTER_TYPES.has(externalAdapter.type);
      if (overridingBuiltin) {
        const existing = adaptersByType.get(externalAdapter.type);
        if (existing && !builtinFallbacks.has(externalAdapter.type)) {
          builtinFallbacks.set(externalAdapter.type, existing);
        }
      }
      adaptersByType.set(externalAdapter.type, resolveExternalAdapterRegistration(externalAdapter));
    }
  } catch (err) {
    console.error("[paperclip] Failed to load external adapters:", err);
  }
})();

export function waitForExternalAdapters(): Promise<void> {
  return externalAdaptersReady;
}

export function getServerAdapter(type: string): ServerAdapterModule {
  const adapter = findActiveServerAdapter(type);
  if (!adapter) {
    return processAdapter;
  }
  return adapter;
}

export async function listAdapterModels(type: string): Promise<{ id: string; label: string }[]> {
  const adapter = findActiveServerAdapter(type);
  if (!adapter) return [];
  if (adapter.listModels) {
    const discovered = await adapter.listModels();
    if (discovered.length > 0) return discovered;
  }
  return adapter.models ?? [];
}

export function listServerAdapters(): ServerAdapterModule[] {
  return Array.from(adaptersByType.values());
}

export function findServerAdapter(type: string): ServerAdapterModule | null {
  return adaptersByType.get(type) ?? null;
}

export function findActiveServerAdapter(type: string): ServerAdapterModule | null {
  if (pausedOverrideTypes.has(type)) {
    const fallback = builtinFallbacks.get(type);
    if (fallback) return fallback;
  }
  return adaptersByType.get(type) ?? null;
}

export function listEnabledServerAdapters(): ServerAdapterModule[] {
  const disabled = getDisabledAdapterTypeSet();
  return Array.from(adaptersByType.values()).filter((adapter) => !disabled.has(adapter.type));
}

export function registerServerAdapter(adapter: ServerAdapterModule): void {
  if (BUILTIN_ADAPTER_TYPES.has(adapter.type) && !builtinFallbacks.has(adapter.type)) {
    const existing = adaptersByType.get(adapter.type);
    if (existing) {
      builtinFallbacks.set(adapter.type, existing);
    }
  }
  adaptersByType.set(adapter.type, adapter);
}

export function unregisterServerAdapter(type: string): boolean {
  if (type === processAdapter.type || type === httpAdapter.type) return false;
  if (builtinFallbacks.has(type)) {
    pausedOverrideTypes.delete(type);
    const fallback = builtinFallbacks.get(type);
    if (fallback) {
      adaptersByType.set(type, fallback);
      return true;
    }
    return false;
  }
  if (BUILTIN_ADAPTER_TYPES.has(type)) return false;
  return adaptersByType.delete(type);
}

export function isOverridePaused(type: string): boolean {
  return pausedOverrideTypes.has(type);
}

export function setOverridePaused(type: string, paused: boolean): boolean {
  if (!builtinFallbacks.has(type)) return false;
  const wasPaused = pausedOverrideTypes.has(type);
  if (paused) {
    pausedOverrideTypes.add(type);
  } else {
    pausedOverrideTypes.delete(type);
  }
  return wasPaused !== paused;
}
