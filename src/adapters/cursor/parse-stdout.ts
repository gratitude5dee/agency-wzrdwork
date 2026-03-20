import type { TranscriptEntry } from "../types";

function normalizeCursorStreamLine(rawLine: string): {
  stream: "stdout" | "stderr" | null;
  line: string;
} {
  const trimmed = rawLine.trim();
  if (!trimmed) return { stream: null, line: "" };
  const prefixed = trimmed.match(/^(stdout|stderr)\s*[:=]?\s*([[{].*)$/i);
  if (!prefixed) return { stream: null, line: trimmed };
  const stream = prefixed[1]?.toLowerCase() === "stderr" ? "stderr" : "stdout";
  const line = (prefixed[2] ?? "").trim();
  return { stream, line };
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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

function parseAssistantMessage(messageRaw: unknown, ts: string): TranscriptEntry[] {
  if (typeof messageRaw === "string") {
    const text = messageRaw.trim();
    return text ? [{ kind: "assistant", ts, text }] : [];
  }
  const message = asRecord(messageRaw);
  if (!message) return [];
  const entries: TranscriptEntry[] = [];
  const directText = asString(message.text).trim();
  if (directText) entries.push({ kind: "assistant", ts, text: directText });
  const content = Array.isArray(message.content) ? message.content : [];
  for (const partRaw of content) {
    const part = asRecord(partRaw);
    if (!part) continue;
    const type = asString(part.type).trim();
    if (type === "output_text" || type === "text") {
      const text = asString(part.text).trim();
      if (text) entries.push({ kind: "assistant", ts, text });
    } else if (type === "thinking") {
      const text = asString(part.text).trim();
      if (text) entries.push({ kind: "thinking", ts, text });
    } else if (type === "tool_call") {
      const name = asString(part.name, asString(part.tool, "tool"));
      entries.push({
        kind: "tool_call",
        ts,
        name,
        toolUseId: asString(part.tool_use_id) || asString(part.call_id) || asString(part.id) || undefined,
        input: part.input ?? part.arguments ?? part.args ?? {},
      });
    } else if (type === "tool_result") {
      const toolUseId =
        asString(part.tool_use_id) || asString(part.call_id) || asString(part.id) || "tool_result";
      const contentText = asString(part.output) || asString(part.text) || stringifyUnknown(part.output ?? part.result);
      const isError = part.is_error === true || asString(part.status).toLowerCase() === "error";
      entries.push({ kind: "tool_result", ts, toolUseId, content: contentText, isError });
    }
  }
  return entries;
}

export function parseCursorStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const normalized = normalizeCursorStreamLine(line);
  if (!normalized.line) return [];
  const parsed = asRecord(safeJsonParse(normalized.line));
  if (!parsed) return [{ kind: "stdout", ts, text: normalized.line }];

  const type = asString(parsed.type);

  if (type === "system") {
    const subtype = asString(parsed.subtype);
    if (subtype === "init") {
      const sessionId =
        asString(parsed.session_id) || asString(parsed.sessionId) || asString(parsed.sessionID);
      return [{ kind: "init", ts, model: asString(parsed.model, "cursor"), sessionId }];
    }
    return [{ kind: "system", ts, text: subtype ? `system: ${subtype}` : "system" }];
  }

  if (type === "assistant") {
    const entries = parseAssistantMessage(parsed.message, ts);
    return entries.length > 0 ? entries : [{ kind: "assistant", ts, text: asString(parsed.result) }];
  }

  if (type === "user") {
    if (typeof parsed.message === "string") {
      const text = parsed.message.trim();
      return text ? [{ kind: "user", ts, text }] : [];
    }
    return [];
  }

  if (type === "thinking") {
    const text = asString(parsed.text) || asString(asRecord(parsed.delta)?.text);
    if (!text.trim()) return [];
    const subtype = asString(parsed.subtype).trim().toLowerCase();
    const isDelta = subtype === "delta" || asRecord(parsed.delta) !== null;
    return [{ kind: "thinking", ts, text: isDelta ? text : text.trim(), ...(isDelta ? { delta: true } : {}) }];
  }

  if (type === "result") {
    const usage = asRecord(parsed.usage);
    const inputTokens = asNumber(usage?.input_tokens, asNumber(usage?.inputTokens));
    const outputTokens = asNumber(usage?.output_tokens, asNumber(usage?.outputTokens));
    const cachedTokens = asNumber(usage?.cached_input_tokens, asNumber(usage?.cachedInputTokens));
    const subtype = asString(parsed.subtype, "result");
    const errors = Array.isArray(parsed.errors)
      ? parsed.errors.map((v) => stringifyUnknown(v)).filter(Boolean)
      : [];
    const isError = parsed.is_error === true || subtype === "error" || subtype === "failed";
    return [
      {
        kind: "result",
        ts,
        text: asString(parsed.result),
        inputTokens,
        outputTokens,
        cachedTokens,
        costUsd: asNumber(parsed.total_cost_usd, asNumber(parsed.cost_usd)),
        subtype,
        isError,
        errors,
      },
    ];
  }

  if (type === "error") {
    const message = asString(parsed.message) || stringifyUnknown(parsed.error ?? parsed.detail) || normalized.line;
    return [{ kind: "stderr", ts, text: message }];
  }

  return [{ kind: "stdout", ts, text: normalized.line }];
}
