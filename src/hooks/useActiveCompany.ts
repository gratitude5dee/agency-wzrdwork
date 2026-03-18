/**
 * useActiveCompany — resolves the active company from wallet address
 * and/or onboarding context, replacing unsafe limit(1) patterns.
 *
 * Resolution strategy:
 *   1. Get the connected wallet address (real or mock).
 *   2. Look up the user_onboarding row for that wallet → company_id.
 *   3. If no onboarding row, fall back to companies.wallet_address match.
 *   4. If still nothing, return null (no active company).
 *
 * This ensures tenant isolation: the returned company is always the one
 * owned by the authenticated wallet, not an arbitrary first row.
 */

import { useQuery } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/integrations/supabase/client";

export interface ActiveCompany {
  id: string;
  name: string;
  slug: string;
  wallet_address: string | null;
}

const ACTIVE_COMPANY_QUERY_KEY = ["active-company"] as const;

function getWalletAddress(accountAddress: string | undefined): string | null {
  const mockWallet = import.meta.env.VITE_DEV_MOCK_WALLET as string | undefined;
  return accountAddress ?? mockWallet ?? null;
}

/**
 * Core resolution: wallet → onboarding row → company_id, or wallet → companies.wallet_address.
 */
async function resolveActiveCompany(walletAddress: string | null): Promise<ActiveCompany | null> {
  if (!walletAddress) return null;

  // Strategy 1: onboarding row points to the company
  const { data: onboarding } = await supabase
    .from("user_onboarding")
    .select("company_id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (onboarding?.company_id) {
    const { data: company, error } = await supabase
      .from("companies")
      .select("id, name, slug, wallet_address")
      .eq("id", onboarding.company_id)
      .maybeSingle();

    if (!error && company) {
      return company as ActiveCompany;
    }
  }

  // Strategy 2: company with matching wallet_address
  const { data: walletCompany, error: walletError } = await supabase
    .from("companies")
    .select("id, name, slug, wallet_address")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (!walletError && walletCompany) {
    return walletCompany as ActiveCompany;
  }

  return null;
}

/**
 * React hook for the active company.
 *
 * Returns `{ company, companyId, isLoading, error }` where company
 * is tenant-safe (derived from the wallet, not a global first-row).
 */
export function useActiveCompany() {
  const account = useActiveAccount();
  const walletAddress = getWalletAddress(account?.address);

  const {
    data: company = null,
    isLoading,
    error,
  } = useQuery<ActiveCompany | null>({
    queryKey: [...ACTIVE_COMPANY_QUERY_KEY, walletAddress],
    queryFn: () => resolveActiveCompany(walletAddress),
    enabled: !!walletAddress,
    staleTime: 30_000,
  });

  return {
    company,
    companyId: company?.id ?? null,
    isLoading,
    error,
  };
}

/**
 * Imperative (non-hook) resolver for use in library functions that receive
 * a wallet address directly. Returns the company or null.
 */
export { resolveActiveCompany };
