/**
 * ERC-8004 Identity Management
 *
 * Creates and manages agent identity rows in the agent_identities Supabase table.
 */

import { supabase } from "@/integrations/supabase/client";
import { buildManifest } from "./manifest";
import type { Database } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";

type AgentIdentityRow = Database["public"]["Tables"]["agent_identities"]["Row"];

/** Well-known zero address (40 hex chars) */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Check whether a wallet address is a placeholder value.
 *
 * Placeholder values include null, undefined, empty string, "0x0",
 * and the Ethereum zero address (0x000…000).
 */
export function isPlaceholderWallet(address: string | null | undefined): boolean {
  if (!address) return true;
  const trimmed = address.trim().toLowerCase();
  if (trimmed === "" || trimmed === "0x0" || trimmed === ZERO_ADDRESS.toLowerCase()) return true;
  return false;
}

/**
 * Create an ERC-8004 identity for an agent.
 *
 * Fetches the agent data from Supabase, builds a manifest, and inserts an
 * agent_identities row with the auto-generated manifest JSONB.
 *
 * @param agentId - The agent's UUID
 * @param companyId - The company's UUID
 * @param operatorWallet - The operator's wallet address (must be a real, non-placeholder value)
 * @returns The newly created agent_identities row
 * @throws If operatorWallet is a placeholder value
 */
export async function createAgentIdentity(
  agentId: string,
  companyId: string,
  operatorWallet: string,
): Promise<AgentIdentityRow> {
  if (isPlaceholderWallet(operatorWallet)) {
    throw new Error(
      `Cannot create ERC-8004 identity with a placeholder wallet address ("${operatorWallet ?? ""}"). ` +
        "A real operator wallet from the active company is required.",
    );
  }
  // Fetch the agent to build the manifest
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, name, role, adapter_type")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    throw new Error(`Failed to fetch agent ${agentId}: ${agentError?.message ?? "not found"}`);
  }

  const manifest = buildManifest(agent, operatorWallet);

  const { data, error } = await supabase
    .from("agent_identities")
    .insert({
      agent_id: agentId,
      company_id: companyId,
      operator_wallet: operatorWallet,
      manifest: manifest as unknown as Json,
      registered_on_chain: false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create identity for agent ${agentId}: ${error?.message ?? "unknown error"}`);
  }

  return data as AgentIdentityRow;
}
