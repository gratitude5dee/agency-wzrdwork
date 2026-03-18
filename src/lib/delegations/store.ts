/**
 * MetaMask Delegation Framework — Persistent Store
 *
 * Company-scoped persistence of delegation chains via the Supabase `integrations`
 * table. Chains are stored as a JSONB array in the `config` column with
 * `integration_key = "metamask_delegations"`.
 *
 * This enables delegation chains to survive page reload and be queried during
 * validation while keeping the in-memory framework as the authoritative runtime
 * for permission checks and status lookups.
 *
 * On load, persisted chains are re-hydrated into the in-memory store so that
 * `getDelegationStatus`, `validatePermission`, and `enforceSpendLimit` continue
 * to work as before.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { DelegationChain, Delegation, Permission } from "./types";
import { clearDelegations, registerDelegation } from "./framework";

const INTEGRATION_KEY = "metamask_delegations";

/* ================================================================
   Types for the persisted shape
   ================================================================ */

/** The shape stored in integrations.config JSONB */
interface PersistedDelegationConfig {
  chains: PersistedChain[];
}

/** A chain as persisted in JSONB (delegations embedded, not in-memory refs) */
interface PersistedChain {
  id: string;
  createdAt: string;
  nodes: PersistedChainNode[];
}

interface PersistedChainNode {
  address: string;
  role: string;
  delegation: PersistedDelegation | null;
}

interface PersistedDelegation {
  id: string;
  from: string;
  to: string;
  permissions: Permission;
  status: string;
  createdAt: string;
  updatedAt: string;
  parentDelegationId?: string;
}

/* ================================================================
   Serialization helpers
   ================================================================ */

/** Serialize a runtime DelegationChain to the persisted shape. */
function serializeChain(chain: DelegationChain): PersistedChain {
  return {
    id: chain.id,
    createdAt: chain.createdAt,
    nodes: chain.nodes.map((node) => ({
      address: node.address,
      role: node.role,
      delegation: node.delegation
        ? {
            id: node.delegation.id,
            from: node.delegation.from,
            to: node.delegation.to,
            permissions: node.delegation.permissions,
            status: node.delegation.status,
            createdAt: node.delegation.createdAt,
            updatedAt: node.delegation.updatedAt,
            parentDelegationId: node.delegation.parentDelegationId,
          }
        : null,
    })),
  };
}

/** Deserialize a persisted chain back to the runtime DelegationChain shape. */
function deserializeChain(pc: PersistedChain): DelegationChain {
  return {
    id: pc.id,
    createdAt: pc.createdAt,
    nodes: pc.nodes.map((node) => ({
      address: node.address,
      role: node.role,
      delegation: node.delegation
        ? ({
            id: node.delegation.id,
            from: node.delegation.from,
            to: node.delegation.to,
            permissions: node.delegation.permissions,
            status: node.delegation.status as Delegation["status"],
            createdAt: node.delegation.createdAt,
            updatedAt: node.delegation.updatedAt,
            parentDelegationId: node.delegation.parentDelegationId,
          } as Delegation)
        : null,
    })),
  };
}

/* ================================================================
   Supabase persistence
   ================================================================ */

/**
 * Load all delegation chains for a company from Supabase.
 *
 * @param companyId - The company UUID
 * @returns Array of deserialized DelegationChain objects
 */
export async function loadDelegationChains(
  companyId: string,
): Promise<DelegationChain[]> {
  const { data, error } = await supabase
    .from("integrations")
    .select("config")
    .eq("company_id", companyId)
    .eq("integration_key", INTEGRATION_KEY)
    .maybeSingle();

  if (error || !data?.config) {
    return [];
  }

  const config = data.config as unknown as PersistedDelegationConfig;
  if (!config.chains || !Array.isArray(config.chains)) {
    return [];
  }

  return config.chains.map(deserializeChain);
}

/**
 * Save delegation chains for a company to Supabase.
 *
 * Upserts the integrations row for `integration_key = "metamask_delegations"`.
 *
 * @param companyId - The company UUID
 * @param chains - The current array of DelegationChain objects
 */
export async function saveDelegationChains(
  companyId: string,
  chains: DelegationChain[],
): Promise<void> {
  const config: PersistedDelegationConfig = {
    chains: chains.map(serializeChain),
  };

  // Check if row already exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", INTEGRATION_KEY)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({
        config: config as unknown as Json,
        enabled: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update delegation chains: ${error.message}`);
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: INTEGRATION_KEY,
      name: "MetaMask Delegations",
      enabled: true,
      config: config as unknown as Json,
    });
    if (error) throw new Error(`Failed to insert delegation chains: ${error.message}`);
  }
}

/**
 * Re-hydrate delegation chains into the in-memory framework store.
 *
 * Clears the current in-memory store and registers all persisted delegations
 * so that `getDelegationStatus`, `validatePermission`, and `enforceSpendLimit`
 * work correctly after reload.
 *
 * @param chains - The chains loaded from Supabase
 */
export function rehydrateDelegationStore(chains: DelegationChain[]): void {
  clearDelegations();
  for (const chain of chains) {
    for (const node of chain.nodes) {
      if (node.delegation) {
        registerDelegation(node.delegation);
      }
    }
  }
}

export { registerDelegation } from "./framework";
