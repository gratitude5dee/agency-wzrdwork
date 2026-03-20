const EXECUTABLE_ADAPTERS = new Set(["process", "http", "codex_local"]);

export function isExecutableAdapter(adapterType: string): boolean {
  return EXECUTABLE_ADAPTERS.has(adapterType);
}

export function adapterExecutionLabel(adapterType: string): string {
  return isExecutableAdapter(adapterType) ? "M1 executable" : "Config only";
}
