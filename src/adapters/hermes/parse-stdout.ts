import type { TranscriptEntry } from "../types";

/**
 * Hermes agent stdout parser.
 *
 * Hermes emits JSON objects for tool calls, thinking blocks, and ACP
 * session updates. Plain text lines are treated as assistant output.
 *
 * JSON formats handled:
 * - Tool calls:     { "type": "tool_call", "name": "...", "args": {...} }
 * - Tool results:   { "type": "tool_result", "tool_use_id": "...", "content": "...", "is_error": false }
 * - Thinking:       { "type": "thinking", "text": "..." }
 * - Agent message:  { "type": "agent_message", "text": "..." }
 * - Tool progress:  { "type": "tool_progress", "name": "...", "preview": "...", "args": {...} }
 * - Step complete:  { "type": "step", "api_call_count": N, "prev_tools": [...] }
 */

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

export function parseHermesStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    // Plain text → assistant output
    if (line.trim()) {
      return [{ kind: "assistant", ts, text: line }];
    }
    return [];
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  // Tool call event
  if (type === "tool_call" || type === "tool_progress") {
    const name = typeof parsed.name === "string" ? parsed.name : "unknown";
    const toolUseId = typeof parsed.tool_call_id === "string" ? parsed.tool_call_id : undefined;
    const input = parsed.args ?? parsed.input ?? {};
    return [{ kind: "tool_call", ts, name, input, toolUseId }];
  }

  // Tool result event
  if (type === "tool_result") {
    const toolUseId = typeof parsed.tool_use_id === "string" ? parsed.tool_use_id : "";
    const isError = parsed.is_error === true;
    let content = "";
    if (typeof parsed.content === "string") {
      content = parsed.content;
    } else if (typeof parsed.result === "string") {
      content = parsed.result;
    }
    return [{ kind: "tool_result", ts, toolUseId, content, isError }];
  }

  // Thinking block
  if (type === "thinking" || type === "thought") {
    const text = typeof parsed.text === "string" ? parsed.text : "";
    if (text) {
      return [{ kind: "thinking", ts, text }];
    }
    return [];
  }

  // Agent message
  if (type === "agent_message" || type === "message") {
    const text = typeof parsed.text === "string" ? parsed.text : "";
    if (text) {
      return [{ kind: "assistant", ts, text }];
    }
    return [];
  }

  // Step completion (from ACP adapter)
  if (type === "step") {
    const count = typeof parsed.api_call_count === "number" ? parsed.api_call_count : 0;
    return [{ kind: "system", ts, text: `Step ${count} completed` }];
  }

  // Error / stderr
  if (type === "error") {
    const text =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : JSON.stringify(parsed);
    return [{ kind: "stderr", ts, text }];
  }

  // Unknown JSON → emit as stdout
  return [{ kind: "stdout", ts, text: line }];
}
