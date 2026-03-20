/**
 * React Query hook for ERC-8004 agent identity CRUD operations.
 *
 * Provides read, create, and update operations for agent_identities rows.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createAgentIdentity } from "@/lib/erc8004/identity";
import type { Database } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import type { AgentManifest } from "@/lib/erc8004/types";

type AgentIdentityRow = Database["public"]["Tables"]["agent_identities"]["Row"];

/** Read the identity for a given agent */
export function useAgentIdentity(agentId: string | undefined) {
  return useQuery<AgentIdentityRow | null>({
    queryKey: ["agent-identity", agentId],
    queryFn: async () => {
      if (!agentId) return null;

      const { data, error } = await supabase
        .from("agent_identities")
        .select("*")
        .eq("agent_id", agentId)
        .maybeSingle();

      if (error) throw error;
      return (data as AgentIdentityRow) ?? null;
    },
    enabled: !!agentId,
  });
}

/** Create an identity for an agent */
export function useCreateAgentIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      companyId,
      operatorWallet,
    }: {
      agentId: string;
      companyId: string;
      operatorWallet: string;
    }) => {
      return createAgentIdentity(agentId, companyId, operatorWallet);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-identity", variables.agentId] });
    },
  });
}

/** Update an existing identity (manifest or registration status) */
export function useUpdateAgentIdentity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      identityId,
      manifest,
      registeredOnChain,
      chainTxHash,
    }: {
      identityId: string;
      manifest?: AgentManifest;
      registeredOnChain?: boolean;
      chainTxHash?: string;
    }) => {
      const updates: Record<string, unknown> = {};
      if (manifest !== undefined) updates.manifest = manifest as unknown as Json;
      if (registeredOnChain !== undefined) updates.registered_on_chain = registeredOnChain;
      if (chainTxHash !== undefined) updates.chain_tx_hash = chainTxHash;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("agent_identities")
        .update(updates)
        .eq("id", identityId)
        .select()
        .single();

      if (error) throw error;
      return data as AgentIdentityRow;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agent-identity", data.agent_id] });
    },
  });
}
