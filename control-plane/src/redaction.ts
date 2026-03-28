import type { JsonObject, JsonValue } from "./types.js";

function uniqueSensitiveValues(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length >= 4),
    ),
  ).sort((left, right) => right.length - left.length);
}

export function redactText(text: string, sensitiveValues: string[]): string {
  if (!text) return text;

  let output = text;
  for (const value of uniqueSensitiveValues(sensitiveValues)) {
    output = output.split(value).join("[REDACTED]");
  }
  return output;
}

export function redactJsonValue<T extends JsonValue | undefined>(
  value: T,
  sensitiveValues: string[],
): T {
  if (typeof value === "string") {
    return redactText(value, sensitiveValues) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJsonValue(item, sensitiveValues)) as T;
  }

  if (value && typeof value === "object") {
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = redactJsonValue(item as JsonValue, sensitiveValues);
    }
    return output as T;
  }

  return value;
}
