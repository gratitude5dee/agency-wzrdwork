import { useEffect, useRef } from "react";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useActiveCompany";

/**
 * Syncs the connected wallet address to the companies table in Supabase.
 * Runs once when a wallet connects (or address changes).
 *
 * Resolution: looks up the company via the user_onboarding row for this
 * wallet, or falls back to companies.wallet_address match. Does NOT use
 * an unscoped limit(1) lookup.
 *
 * VAL-AUTH-003: Real-wallet auth writes the active company wallet
 * address to the correct company row. This works with or without
 * bypass mode.
 *
 * When VITE_DEV_MOCK_WALLET is set, uses that value as the wallet address
 * so wallet persistence works even when auth is bypassed.
 */
export function useWalletAddressSync() {
  const account = useActiveAccount();
  const mockWallet = import.meta.env.VITE_DEV_MOCK_WALLET as string | undefined;
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    const address = account?.address ?? mockWallet ?? undefined;
    if (!address || address === lastSynced.current) return;

    lastSynced.current = address;

    (async () => {
      try {
        // Resolve the company for this wallet via onboarding context
        const { data: onboarding } = await supabase
          .from("user_onboarding")
          .select("company_id")
          .eq("wallet_address", address)
          .maybeSingle();

        let companyId = onboarding?.company_id ?? null;

        // Fallback: find a company already linked to this wallet
        if (!companyId) {
          const { data: walletCompany } = await supabase
            .from("companies")
            .select("id")
            .eq("wallet_address", address)
            .maybeSingle();
          companyId = walletCompany?.id ?? null;
        }

        if (companyId) {
          await supabase
            .from("companies")
            .update({ wallet_address: address })
            .eq("id", companyId);
        }
      } catch (err) {
        console.error("[WalletSync] Failed to persist wallet address:", err);
      }
    })();
  }, [account?.address]);
}

/**
 * Returns the truncated wallet address in "0xAbCd…EfGh" format,
 * or null if no wallet is connected.
 *
 * Falls back to VITE_DEV_MOCK_WALLET when no real wallet is connected,
 * so the header displays a mock address during dev/testing.
 */
export function useTruncatedAddress(): string | null {
  const account = useActiveAccount();
  const mockWallet = import.meta.env.VITE_DEV_MOCK_WALLET as string | undefined;
  const addr = account?.address ?? mockWallet ?? null;
  if (!addr) return null;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Returns the stored wallet address from the active company record.
 * This is the persisted wallet in Supabase, not the live thirdweb connection.
 *
 * VAL-AUTH-004: Used by header and settings to show the same stored wallet
 * after reload, ensuring consistency between surfaces.
 */
export function useStoredWalletAddress(): {
  storedAddress: string | null;
  isLoading: boolean;
} {
  const { company, isLoading } = useActiveCompany();
  return {
    storedAddress: company?.wallet_address ?? null,
    isLoading,
  };
}
