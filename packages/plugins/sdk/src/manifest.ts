import type {
  PluginCommand,
  PluginCommandArgument,
  PluginEntrypoint,
  PluginId,
  PluginManifest,
  PluginScaffoldFile,
  PluginScaffoldTemplate,
  PluginVersion,
  PluginWorkerConfig,
} from "../../../shared/src/index.js";

export type {
  PluginCommand,
  PluginCommandArgument,
  PluginEntrypoint,
  PluginId,
  PluginManifest,
  PluginScaffoldFile,
  PluginScaffoldTemplate,
  PluginVersion,
  PluginWorkerConfig,
};

export function createPluginId(value: string): PluginId {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createPluginManifest(manifest: PluginManifest): PluginManifest {
  return {
    ...manifest,
    id: createPluginId(manifest.id),
  };
}

export function createScaffoldTemplate(
  name: string,
  files: PluginScaffoldFile[],
  description?: string,
): PluginScaffoldTemplate {
  return {
    name,
    description,
    files,
  };
}

export function createWorkerConfig(
  runtime: PluginWorkerConfig["runtime"] = "node",
  timeoutMs?: number,
): PluginWorkerConfig {
  return timeoutMs === undefined ? { runtime } : { runtime, timeoutMs };
}
