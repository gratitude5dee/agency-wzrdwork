import type { CreateConfigValues } from "../types";

/**
 * Build Hermes-specific adapter config from form values.
 *
 * The Hermes agent uses a config.yaml at ~/.hermes/ (HERMES_HOME).
 * The adapter config mirrors the key runtime settings.
 */

/** Default model used by Hermes. */
export const HERMES_DEFAULT_MODEL = "anthropic/claude-opus-4.6";

/** Provider options for Hermes. */
export const HERMES_PROVIDERS = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "auto", label: "Auto-detect" },
] as const;

/** Available models for Hermes. */
export const HERMES_MODELS = [
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6 (Anthropic)" },
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4 (Anthropic)" },
  { id: "openai/gpt-4o", label: "GPT-4o (OpenAI)" },
  { id: "openai/o3", label: "o3 (OpenAI)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Google)" },
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Google)" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
  { id: "meta-llama/llama-3.3-70b", label: "Llama 3.3 70B (Meta)" },
] as const;

/** Hermes toolsets from the Hermes tools registry. */
export const HERMES_TOOLSETS = [
  { value: "web", label: "Web Search & Browse" },
  { value: "terminal", label: "Terminal / Shell" },
  { value: "file", label: "File System" },
  { value: "browser", label: "Browser Automation" },
  { value: "research", label: "Research & Analysis" },
  { value: "code", label: "Code Generation" },
  { value: "delegate", label: "Delegation / Sub-agents" },
] as const;

/** Memory mode options for Hermes. */
export const HERMES_MEMORY_MODES = [
  { value: "local", label: "Local (file-based)" },
  { value: "honcho", label: "Honcho (AI-native)" },
  { value: "hybrid", label: "Hybrid (local + Honcho)" },
] as const;

export interface McpServerEntry {
  name: string;
  url: string;
}

/**
 * Extended form values specific to Hermes.
 * These are stored as JSON in the envBindings or as custom keys in CreateConfigValues.
 */
export interface HermesConfigExtras {
  hermesModel: string;
  hermesProvider: string;
  enabledToolsets: string[];
  memoryMode: string;
  mcpServers: McpServerEntry[];
}

const HERMES_EXTRAS_KEY = "__hermes_extras__";

/** Read Hermes-specific extras from CreateConfigValues.envBindings. */
export function getHermesExtras(values: CreateConfigValues): HermesConfigExtras {
  const raw = values.envBindings[HERMES_EXTRAS_KEY];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    return {
      hermesModel: typeof rec.hermesModel === "string" ? rec.hermesModel : HERMES_DEFAULT_MODEL,
      hermesProvider: typeof rec.hermesProvider === "string" ? rec.hermesProvider : "auto",
      enabledToolsets: Array.isArray(rec.enabledToolsets)
        ? (rec.enabledToolsets as string[])
        : ["web", "terminal", "file", "code"],
      memoryMode: typeof rec.memoryMode === "string" ? rec.memoryMode : "local",
      mcpServers: Array.isArray(rec.mcpServers)
        ? (rec.mcpServers as McpServerEntry[])
        : [],
    };
  }
  return {
    hermesModel: HERMES_DEFAULT_MODEL,
    hermesProvider: "auto",
    enabledToolsets: ["web", "terminal", "file", "code"],
    memoryMode: "local",
    mcpServers: [],
  };
}

/** Write Hermes-specific extras into CreateConfigValues. */
export function setHermesExtras(
  set: (patch: Partial<CreateConfigValues>) => void,
  current: CreateConfigValues,
  patch: Partial<HermesConfigExtras>,
) {
  const existing = getHermesExtras(current);
  const merged = { ...existing, ...patch };
  set({
    envBindings: {
      ...current.envBindings,
      [HERMES_EXTRAS_KEY]: merged as unknown as Record<string, unknown>,
    },
  });
}

export function buildHermesConfig(values: CreateConfigValues): Record<string, unknown> {
  const extras = getHermesExtras(values);

  return {
    hermes_home: "~/.hermes",
    model: extras.hermesModel || HERMES_DEFAULT_MODEL,
    provider: extras.hermesProvider || "auto",
    enabled_toolsets: extras.enabledToolsets.length > 0
      ? extras.enabledToolsets
      : ["web", "terminal", "file", "code"],
    memory_mode: extras.memoryMode || "local",
    mcp_servers: extras.mcpServers.filter((s) => s.name.trim() && s.url.trim()),
    max_turns: values.maxTurnsPerRun || 90,
  };
}
