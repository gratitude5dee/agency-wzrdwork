import path from "node:path";
import type { JsonObject, JsonValue, RuntimeStateData, TokenUsage } from "./types.js";

export const SUPPORTED_EXECUTION_ADAPTERS = new Set([
  "process",
  "http",
  "claude_local",
  "codex_local",
  "cursor",
  "gemini_local",
  "openclaw_gateway",
  "opencode_local",
  "pi_local",
]);

export function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonObject;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asInteger(value: unknown, fallback = 0): number {
  const numeric = asNumber(value, fallback);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function truncate(text: string, max = 4000): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function summarizeTask(payload: JsonObject, fallback: string): string {
  const task = asString(payload.task).trim();
  if (task) return task;
  const summary = asString(payload.summary).trim();
  if (summary) return summary;
  const reason = asString(payload.reason).trim();
  if (reason) return reason;
  return fallback;
}

export function parseHeartbeatSettings(config: JsonObject): {
  enabled: boolean;
  intervalSec: number;
} {
  return {
    enabled: asBoolean(config.heartbeatEnabled, false),
    intervalSec: Math.max(0, asInteger(config.intervalSec, 0)),
  };
}

export function parseRuntimeState(value: unknown): RuntimeStateData {
  const raw = asObject(value);
  return {
    ...raw,
    lastHeartbeatAt: asString(raw.lastHeartbeatAt) || undefined,
    nextHeartbeatAt: asString(raw.nextHeartbeatAt) || undefined,
    consecutiveFailures: asInteger(raw.consecutiveFailures, 0),
    activeWakeupRequestId: asString(raw.activeWakeupRequestId) || null,
  };
}

export function mergeRuntimeState(
  current: RuntimeStateData,
  patch: Partial<RuntimeStateData>,
): RuntimeStateData {
  return {
    ...current,
    ...patch,
  };
}

export function isSupportedExecutionAdapter(adapterType: string): boolean {
  return SUPPORTED_EXECUTION_ADAPTERS.has(adapterType);
}

export function commandBasename(command: string): string {
  const trimmed = command.trim();
  if (!trimmed) return "";
  return path.basename(trimmed);
}

export function enforceAllowedCommand(
  command: string,
  allowlist: string[],
  label: string,
): void {
  const basename = commandBasename(command);
  if (!basename) {
    throw new Error(`${label} command is required`);
  }
  if (!allowlist.includes(basename)) {
    throw new Error(
      `${label} command "${basename}" is not allowlisted. Allowed: ${allowlist.join(", ")}`,
    );
  }
}

export function normalizeUsage(usage?: Partial<TokenUsage>): TokenUsage {
  return {
    inputTokens: asInteger(usage?.inputTokens, 0),
    cachedInputTokens: asInteger(usage?.cachedInputTokens, 0),
    outputTokens: asInteger(usage?.outputTokens, 0),
    costUsd: asNumber(usage?.costUsd, 0),
  };
}

export function extractSummaryFromValue(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  const direct =
    asString(raw.summary).trim() ||
    asString(raw.message).trim() ||
    asString(raw.text).trim() ||
    asString(raw.result).trim();
  return direct || fallback;
}

export function coerceJsonObject(value: unknown, fallbackSummary: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { summary: fallbackSummary, text: typeof value === "string" ? value : "" };
  }
  return value as JsonObject;
}

export function nextIntervalIso(intervalSec: number, now = new Date()): string | undefined {
  if (intervalSec <= 0) return undefined;
  return new Date(now.getTime() + intervalSec * 1000).toISOString();
}

export function isHeartbeatDue(
  state: RuntimeStateData,
  now = new Date(),
): boolean {
  if (state.activeWakeupRequestId) return false;
  if (!state.nextHeartbeatAt) return true;
  return new Date(state.nextHeartbeatAt) <= now;
}

export function shouldRetryWakeup(
  attemptCount: number,
  maxAttempts: number,
): boolean {
  return attemptCount < maxAttempts;
}

export function toJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value as JsonValue;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }
  if (typeof value === "object") {
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] = toJsonValue(item);
    }
    return output;
  }
  return String(value);
}
