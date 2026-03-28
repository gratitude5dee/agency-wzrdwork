import type { UIAdapterModule } from "./types";
import { claudeLocalUIAdapter } from "./claude-local";
import { codexLocalUIAdapter } from "./codex-local";
import { cursorLocalUIAdapter } from "./cursor";
import { geminiLocalUIAdapter } from "./gemini-local";
import { openCodeLocalUIAdapter } from "./opencode-local";
import { piLocalUIAdapter } from "./pi-local";
import { openClawGatewayUIAdapter } from "./openclaw-gateway";
import { processUIAdapter } from "./process";
import { httpUIAdapter } from "./http";
import { hermesUIAdapter } from "./hermes";

/** Map of adapter type → UIAdapterModule for all registered adapters. */
export const adapterRegistry = new Map<string, UIAdapterModule>(
  [
    claudeLocalUIAdapter,
    codexLocalUIAdapter,
    geminiLocalUIAdapter,
    openCodeLocalUIAdapter,
    piLocalUIAdapter,
    cursorLocalUIAdapter,
    openClawGatewayUIAdapter,
    processUIAdapter,
    httpUIAdapter,
    hermesUIAdapter,
  ].map((a) => [a.type, a]),
);

/**
 * Look up a UI adapter by type string.
 * Falls back to the `process` adapter for unknown types.
 */
export function getUIAdapter(type: string): UIAdapterModule {
  return adapterRegistry.get(type) ?? processUIAdapter;
}
