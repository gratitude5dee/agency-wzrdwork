/**
 * Composio API client for tool and app discovery.
 * Wraps calls to the server-side Composio proxy.
 */

import type { ComposioTool, ComposioApp } from "./types";

const COMPOSIO_BASE = "/api/composio";

async function composioFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${COMPOSIO_BASE}${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Composio API error: ${res.status}`);
  return res.json();
}

export const ComposioClient = {
  /** List available apps/integrations */
  listApps: () => composioFetch<ComposioApp[]>("/apps"),

  /** List tools for a specific app */
  listTools: (appKey: string) => composioFetch<ComposioTool[]>(`/apps/${appKey}/tools`),

  /** Search tools across all apps */
  searchTools: (query: string) =>
    composioFetch<ComposioTool[]>(`/tools/search?q=${encodeURIComponent(query)}`),

  /** Get tool details */
  getTool: (toolId: string) => composioFetch<ComposioTool>(`/tools/${toolId}`),
};
