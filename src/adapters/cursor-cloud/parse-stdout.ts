import type { TranscriptEntry } from "../types";

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseSdkMessage(messageRaw: unknown, ts: string): TranscriptEntry[] {
  const message = asRecord(messageRaw);
  if (!message) return [];
  const type = asString(message.type);
  if (type === "assistant") {
    const body = asRecord(message.message);
    const content = Array.isArray(body?.content) ? body.content : [];
    return content.flatMap((partRaw): TranscriptEntry[] => {
      const part = asRecord(partRaw);
      if (!part) return [];
      if (asString(part.type) === "tool_use") return [{ kind: "tool_call", ts, name: asString(part.name, "tool"), toolUseId: asString(part.id) || undefined, input: part.input ?? {} } satisfies TranscriptEntry];
      const text = asString(part.text).trim();
      return text ? [{ kind: "assistant", ts, text } satisfies TranscriptEntry] : [];
    });
  }
  if (type === "user") return [{ kind: "user", ts, text: stringifyUnknown(message.message) }];
  if (type === "thinking") return [{ kind: "thinking", ts, text: asString(message.text) }];
  if (type === "tool_call") {
    const toolUseId = asString(message.call_id, asString(message.id, "tool_call"));
    const status = asString(message.status).toLowerCase();
    if (status === "completed" || status === "error") {
      return [{ kind: "tool_result", ts, toolUseId, toolName: asString(message.name, "tool"), content: stringifyUnknown(message.result ?? message.args ?? {}), isError: status === "error" }];
    }
    return [{ kind: "tool_call", ts, name: asString(message.name, "tool"), toolUseId, input: message.args ?? {} }];
  }
  return [];
}

export function parseCursorCloudStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) return [{ kind: "stdout", ts, text: line }];
  const type = asString(parsed.type);
  if (type === "cursor_cloud.init") {
    return [{ kind: "init", ts, model: asString(parsed.model, "cursor_cloud"), sessionId: asString(parsed.sessionId, asString(parsed.agentId)) }];
  }
  if (type === "cursor_cloud.status") {
    return [{ kind: "system", ts, text: `${asString(parsed.status, "status")}${parsed.message ? `: ${asString(parsed.message)}` : ""}` }];
  }
  if (type === "cursor_cloud.message") return parseSdkMessage(parsed.message, ts);
  if (type === "cursor_cloud.result") {
    const status = asString(parsed.status, "error");
    return [{ kind: "result", ts, text: asString(parsed.result), inputTokens: 0, outputTokens: 0, cachedTokens: 0, costUsd: 0, subtype: status, isError: status !== "finished", errors: parsed.error ? [asString(parsed.error)] : [] }];
  }
  return [{ kind: "stdout", ts, text: line }];
}
