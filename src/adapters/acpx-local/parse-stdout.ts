import type { TranscriptEntry } from "../types";

function parseJson(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pickToolUseId(parsed: Record<string, unknown>): string {
  return asString(parsed.toolCallId) || asString(parsed.toolUseId) || asString(parsed.id);
}

export function parseAcpxStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = parseJson(line);
  if (!parsed) return [{ kind: "stdout", ts, text: line }];
  const type = asString(parsed.type);
  if (type === "acpx.session") {
    const agent = asString(parsed.agent, "acpx");
    const mode = asString(parsed.mode);
    const permissionMode = asString(parsed.permissionMode);
    const tail = [mode, permissionMode].filter(Boolean).join(" / ");
    return [{ kind: "init", ts, model: tail ? `${agent} (${tail})` : agent, sessionId: asString(parsed.acpSessionId) || asString(parsed.sessionId) || asString(parsed.runtimeSessionName) }];
  }
  if (type === "acpx.text_delta") {
    const text = asString(parsed.text);
    const channel = asString(parsed.channel) || asString(parsed.stream);
    return text ? [{ kind: channel === "thought" || channel === "thinking" ? "thinking" : "assistant", ts, text, delta: true }] : [];
  }
  if (type === "acpx.tool_call") {
    const status = asString(parsed.status);
    const name = asString(parsed.name, "acp_tool");
    const toolUseId = pickToolUseId(parsed);
    const entries: TranscriptEntry[] = [{ kind: "tool_call", ts, name, toolUseId: toolUseId || undefined, input: parsed.input ?? {} }];
    if (status === "completed" || status === "failed" || status === "cancelled") {
      entries.push({ kind: "tool_result", ts, toolUseId: toolUseId || name, toolName: name, content: asString(parsed.text) || status, isError: status !== "completed" });
    }
    return entries;
  }
  if (type === "acpx.tool_result") {
    return [{ kind: "tool_result", ts, toolUseId: pickToolUseId(parsed) || asString(parsed.name, "acp_tool"), toolName: asString(parsed.name) || undefined, content: stringify(parsed.content ?? parsed.output ?? parsed.error), isError: parsed.isError === true || parsed.error !== undefined }];
  }
  if (type === "acpx.status") return [{ kind: "system", ts, text: asString(parsed.text, asString(parsed.tag, "status")) }];
  if (type === "acpx.result") {
    return [{ kind: "result", ts, text: asString(parsed.summary, asString(parsed.stopReason, asString(parsed.text))), inputTokens: asNumber(parsed.inputTokens), outputTokens: asNumber(parsed.outputTokens), cachedTokens: asNumber(parsed.cachedTokens), costUsd: asNumber(parsed.costUsd), subtype: asString(parsed.subtype, asString(parsed.stopReason, "acpx.result")), isError: parsed.isError === true, errors: Array.isArray(parsed.errors) ? parsed.errors.map((error) => stringify(error)).filter(Boolean) : [] }];
  }
  if (type === "acpx.error") return [{ kind: "stderr", ts, text: asString(parsed.message, line) }];
  return [{ kind: type.startsWith("acpx.") ? "system" : "stdout", ts, text: asString(parsed.message, line) }];
}
