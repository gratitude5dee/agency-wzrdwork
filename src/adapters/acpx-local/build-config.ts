import type { CreateConfigValues } from "../types";

const DEFAULT_AGENT = "claude";
const DEFAULT_MODE = "persistent";
const DEFAULT_PERMISSION_MODE = "approve-all";
const DEFAULT_NON_INTERACTIVE_PERMISSIONS = "deny";

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

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function buildAcpxLocalConfig(v: CreateConfigValues): Record<string, unknown> {
  const schema = v.adapterSchemaValues ?? {};
  const agent = String(schema.agent || DEFAULT_AGENT);
  const ac: Record<string, unknown> = {
    agent,
    mode: schema.mode || DEFAULT_MODE,
    permissionMode: schema.permissionMode || DEFAULT_PERMISSION_MODE,
    nonInteractivePermissions: schema.nonInteractivePermissions || DEFAULT_NON_INTERACTIVE_PERMISSIONS,
    timeoutSec: readNumber(schema.timeoutSec, 0),
    warmHandleIdleMs: readNumber(schema.warmHandleIdleMs, 0),
  };
  for (const key of ["agentCommand", "stateDir"]) {
    const value = schema[key];
    if (typeof value === "string" && value.trim()) ac[key] = value.trim();
  }
  if (v.cwd) ac.cwd = v.cwd;
  if (v.instructionsFilePath) ac.instructionsFilePath = v.instructionsFilePath;
  if (v.promptTemplate) ac.promptTemplate = v.promptTemplate;
  if (v.bootstrapPrompt) ac.bootstrapPromptTemplate = v.bootstrapPrompt;
  if (v.model?.trim()) ac.model = v.model.trim();
  if (v.thinkingEffort) ac[agent === "codex" ? "modelReasoningEffort" : "effort"] = v.thinkingEffort;
  if (schema.fastMode === true) ac.fastMode = true;
  const env: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parseEnvVars(v.envVars))) env[key] = { type: "plain", value };
  if (Object.keys(env).length > 0) ac.env = env;
  return ac;
}
