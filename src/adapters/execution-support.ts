const EXECUTABLE_ADAPTERS = new Set([
  "process",
  "http",
  "claude_local",
  "codex_local",
  "cursor",
  "gemini_local",
  "grok_local",
  "openclaw_gateway",
  "opencode_local",
  "pi_local",
  "acpx_local",
  "cursor_cloud",
]);

export function isExecutableAdapter(adapterType: string): boolean {
  return EXECUTABLE_ADAPTERS.has(adapterType);
}

export function adapterExecutionLabel(adapterType: string): string {
  return isExecutableAdapter(adapterType) ? "Executable" : "Config only";
}
