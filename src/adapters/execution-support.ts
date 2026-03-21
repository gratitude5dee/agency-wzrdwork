const EXECUTABLE_ADAPTERS = new Set([
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

export function isExecutableAdapter(adapterType: string): boolean {
  return EXECUTABLE_ADAPTERS.has(adapterType);
}

export function adapterExecutionLabel(adapterType: string): string {
  return isExecutableAdapter(adapterType) ? "Executable" : "Config only";
}
