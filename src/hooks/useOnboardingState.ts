/**
 * useOnboardingState — reads/writes the user_onboarding table.
 *
 * On app load, checks whether onboarding is completed for the connected
 * wallet address. Persists current_step so refreshing mid-onboarding
 * resumes at the correct step.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type OnboardingRow = Database["public"]["Tables"]["user_onboarding"]["Row"];

export interface OnboardingState {
  /** Whether the onboarding data is still loading */
  isLoading: boolean;
  /** Whether onboarding has been completed */
  isCompleted: boolean;
  /** Current step index (0-based) */
  currentStep: number;
  /** The company_id from the onboarding row (if any) */
  companyId: string | null;
  /** The CEO agent_id stored in metadata (if any) */
  ceoAgentId: string | null;
  /** Raw onboarding row */
  row: OnboardingRow | null;
  /** Advance to the next step (persists to Supabase) */
  setStep: (step: number) => void;
  /** Store the CEO agent ID in onboarding metadata */
  setCeoAgentId: (agentId: string) => void;
  /** Mark onboarding as completed */
  markCompleted: () => void;
  /** Reset onboarding (re-show wizard) */
  resetOnboarding: () => void;
}

const ONBOARDING_QUERY_KEY = ["user-onboarding"] as const;

/**
 * Fetches onboarding state for a given wallet address.
 * If walletAddress is empty/null, returns null.
 */
async function fetchOnboardingState(walletAddress: string | null): Promise<OnboardingRow | null> {
  if (!walletAddress) return null;

  const { data, error } = await supabase
    .from("user_onboarding")
    .select("*")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (error) {
    console.error("[Onboarding] Failed to fetch state:", error.message);
    return null;
  }
  return data;
}

/**
 * Creates or updates an onboarding row.
 */
async function upsertOnboarding(
  walletAddress: string,
  companyId: string,
  patch: Partial<Pick<OnboardingRow, "current_step" | "onboarding_completed" | "metadata">>,
): Promise<OnboardingRow | null> {
  // Try to update first
  const { data: existing } = await supabase
    .from("user_onboarding")
    .select("id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("user_onboarding")
      .update(patch)
      .eq("wallet_address", walletAddress)
      .select()
      .single();

    if (error) {
      console.error("[Onboarding] Failed to update:", error.message);
      return null;
    }
    return data;
  }

  // Insert new row
  const { data, error } = await supabase
    .from("user_onboarding")
    .insert({
      wallet_address: walletAddress,
      company_id: companyId,
      current_step: patch.current_step ?? 0,
      onboarding_completed: patch.onboarding_completed ?? false,
      metadata: patch.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    console.error("[Onboarding] Failed to insert:", error.message);
    return null;
  }
  return data;
}

export function useOnboardingState(walletAddress: string | null): OnboardingState {
  const queryClient = useQueryClient();

  const { data: row = null, isLoading } = useQuery<OnboardingRow | null>({
    queryKey: [...ONBOARDING_QUERY_KEY, walletAddress],
    queryFn: () => fetchOnboardingState(walletAddress),
    enabled: !!walletAddress,
    staleTime: 30_000,
  });

  const stepMutation = useMutation({
    mutationFn: async (step: number) => {
      if (!walletAddress || !row?.company_id) return null;
      return upsertOnboarding(walletAddress, row.company_id, { current_step: step });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress || !row?.company_id) return null;
      return upsertOnboarding(walletAddress, row.company_id, {
        onboarding_completed: true,
        current_step: 4,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });

  const ceoAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      if (!walletAddress || !row?.company_id) return null;
      const currentMetadata = (row?.metadata ?? {}) as Record<string, unknown>;
      return upsertOnboarding(walletAddress, row.company_id, {
        metadata: { ...currentMetadata, ceo_agent_id: agentId },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress || !row?.company_id) return null;
      return upsertOnboarding(walletAddress, row.company_id, {
        onboarding_completed: false,
        current_step: 0,
        metadata: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
  });

  // Extract ceo_agent_id from metadata
  const metadata = (row?.metadata ?? {}) as Record<string, unknown>;
  const ceoAgentId = typeof metadata.ceo_agent_id === "string" ? metadata.ceo_agent_id : null;

  return {
    isLoading,
    isCompleted: row?.onboarding_completed ?? false,
    currentStep: row?.current_step ?? 0,
    companyId: row?.company_id ?? null,
    ceoAgentId,
    row,
    setStep: (step: number) => stepMutation.mutate(step),
    setCeoAgentId: (agentId: string) => ceoAgentMutation.mutate(agentId),
    markCompleted: () => completeMutation.mutate(),
    resetOnboarding: () => resetMutation.mutate(),
  };
}
