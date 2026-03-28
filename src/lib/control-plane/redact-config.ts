function shouldRedactKey(key: string): boolean {
  return /secret|token|key|password|authorization|auth/i.test(key);
}

export function redactAdapterConfigForDisplay(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAdapterConfigForDisplay);
  }

  if (!value || typeof value !== "object") return value;

  const record = value as Record<string, unknown>;

  if (record.kind === "secret_ref" && typeof record.secretName === "string") {
    return {
      kind: "secret_ref",
      secretName: record.secretName,
    };
  }

  if (
    record.type === "plain" &&
    typeof record.value === "string"
  ) {
    return {
      type: "plain",
      value: "[REDACTED]",
    };
  }

  if (
    record.type === "secret_ref" &&
    (typeof record.secretName === "string" || typeof record.secretId === "string")
  ) {
    return {
      kind: "secret_ref",
      secretName:
        (typeof record.secretName === "string" && record.secretName) ||
        (typeof record.secretId === "string" && record.secretId) ||
        "secret",
    };
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === "string" && shouldRedactKey(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = redactAdapterConfigForDisplay(item);
  }
  return output;
}
