/**
 * Composio Plugin Layer
 *
 * Structured module for adapter config, plugin manifest handling,
 * and skill/tool discovery integration with OpenClaw.
 */

export { ComposioClient } from "./client";
export type { ComposioTool, ComposioApp, PluginManifest, AdapterConfig } from "./types";
export { resolveAdapterConfig, mergeAdapterOverrides } from "./adapter-config";
export { parsePluginManifest, validateManifest } from "./manifest";
