import type { CreateConfigValues } from "../types";

function parseEnvVars(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) env[key] = value;
  }
  return env;
}

function parseEnvBindings(bindings: unknown): Record<string, unknown> {
  if (typeof bindings !== "object" || bindings === null || Array.isArray(bindings)) return {};
  const env: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(bindings)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (typeof raw === "string") env[key] = { type: "plain", value: raw };
  }
  return env;
}

export function buildCursorCloudConfig(values: CreateConfigValues): Record<string, unknown> {
  const config: Record<string, unknown> = { ...(values.adapterSchemaValues ?? {}) };
  if (values.instructionsFilePath) config.instructionsFilePath = values.instructionsFilePath;
  if (values.promptTemplate) config.promptTemplate = values.promptTemplate;
  if (values.bootstrapPrompt) config.bootstrapPromptTemplate = values.bootstrapPrompt;
  if (values.model?.trim()) config.model = values.model.trim();
  const env = parseEnvBindings(values.envBindings);
  for (const [key, value] of Object.entries(parseEnvVars(values.envVars))) {
    if (!Object.prototype.hasOwnProperty.call(env, key)) env[key] = { type: "plain", value };
  }
  if (Object.keys(env).length > 0) config.env = env;
  return config;
}
