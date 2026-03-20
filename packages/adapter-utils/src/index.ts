export function redactSecrets(value: string, secrets: string[]): string {
  let next = value;
  for (const secret of secrets) {
    if (!secret) continue;
    next = next.split(secret).join("[REDACTED]");
  }
  return next;
}
