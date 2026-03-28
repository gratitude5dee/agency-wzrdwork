/**
 * Adapter configuration resolution and override merging.
 */

import type { AdapterConfig } from "./types";

const DEFAULT_CONFIGS: Record<string, Partial<AdapterConfig>> = {
  claude: { model: "claude-sonnet-4-20250514", temperature: 0.7, maxTokens: 4096 },
  openai: { model: "gpt-4o", temperature: 0.7, maxTokens: 4096 },
  venice: { model: "llama-3.3-70b", temperature: 0.7, maxTokens: 4096 },
  hermes: { model: "hermes-3-llama-3.1-70b", temperature: 0.7, maxTokens: 4096 },
};

/** Resolve a full adapter config from type + optional partial overrides. */
export function resolveAdapterConfig(
  adapterType: string,
  overrides?: Partial<AdapterConfig>,
): AdapterConfig {
  const base = DEFAULT_CONFIGS[adapterType] ?? {};
  return {
    adapterType,
    ...base,
    ...overrides,
    tools: [...(base.tools ?? []), ...(overrides?.tools ?? [])],
    integrations: [...(base.integrations ?? []), ...(overrides?.integrations ?? [])],
  };
}

/** Deep-merge adapter overrides, preferring the override values. */
export function mergeAdapterOverrides(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined && value !== null) {
      result[key] = value;
    }
  }
  return result;
}
