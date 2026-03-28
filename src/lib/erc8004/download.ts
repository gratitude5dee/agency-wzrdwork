/**
 * ERC-8004 Artifact Download Utilities
 *
 * Provides functions to retrieve and download agent.json manifests
 * and run-scoped agent_log.json artifacts as files.
 *
 * These surfaces fulfil VAL-PROTOCOL-001 and VAL-PROTOCOL-002.
 */

import { supabase } from "@/integrations/supabase/client";
import { exportRunLog } from "./execution-log";
import { redactRunLogExport } from "@/lib/venice/private-reasoning";
import type { AgentManifest } from "./types";
import type { RunLogExport } from "./execution-log";
import type { Database } from "@/integrations/supabase/types";

type AgentIdentityRow = Database["public"]["Tables"]["agent_identities"]["Row"];

/** The full agent.json download artifact shape */
export interface AgentManifestDownload extends AgentManifest {
  agent_id: string;
  company_id: string;
  registered_on_chain: boolean;
  chain_tx_hash: string | null;
}

/**
 * Retrieve the agent.json manifest data for a given agent.
 *
 * Fetches the agent_identities row, validates the manifest field,
 * and returns a fully-formed agent.json object with identity metadata.
 *
 * @param agentId - The agent's UUID
 * @returns The agent.json manifest data ready for download
 * @throws If no identity or manifest exists for the agent
 */
export async function getAgentManifestJson(agentId: string): Promise<AgentManifestDownload> {
  const { data: identity, error } = await supabase
    .from("agent_identities")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch identity for agent ${agentId}: ${error.message}`,
    );
  }

  if (!identity) {
    throw new Error(
      `No ERC-8004 identity found for agent ${agentId}. Create the agent through the standard flow first.`,
    );
  }

  const row = identity as AgentIdentityRow;
  const manifest = row.manifest as unknown as AgentManifest | null;

  if (!manifest) {
    throw new Error(
      `No manifest data in identity for agent ${agentId}. The identity row exists but has no manifest.`,
    );
  }

  return {
    ...manifest,
    agent_id: row.agent_id,
    company_id: row.company_id,
    registered_on_chain: row.registered_on_chain ?? false,
    chain_tx_hash: row.chain_tx_hash ?? null,
  };
}

/**
 * Retrieve the run-scoped agent_log.json data for a given run.
 *
 * Delegates to exportRunLog which builds the Protocol Labs envelope,
 * then applies Venice private reasoning redaction to ensure operator-
 * visible artifacts never expose private cognition content.
 *
 * @param runId - The run's UUID
 * @returns The run-scoped agent_log.json export data with private reasoning redacted
 */
export async function getRunLogJson(runId: string): Promise<RunLogExport> {
  const rawExport = await exportRunLog(runId);
  return redactRunLogExport(rawExport);
}

/**
 * Trigger a browser download of a JSON object as a file.
 *
 * Creates a temporary Blob URL, triggers a click on a hidden anchor,
 * then revokes the URL.
 *
 * @param data - The JSON-serializable data to download
 * @param filename - The filename for the download (e.g., "agent.json")
 */
export function triggerJsonDownload(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
