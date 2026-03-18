import type { ReactNode } from "react";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import { useWalletAddressSync } from "@/hooks/useWalletAddressSync";
import { WalletAuthScreen } from "@/components/WalletAuth";

/**
 * Auth gate: shows the wallet-auth surface on protected routes when no
 * wallet is connected.  Once connected, renders children (the main app)
 * and syncs the wallet address to the Supabase companies table.
 *
 * VAL-AUTH-001: Protected routes require wallet authentication.
 * Instead of redirecting to /auth, the gate renders the auth surface
 * inline so the user sees it directly on whatever protected route they
 * tried to reach.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const account = useActiveAccount();
  const status = useActiveWalletConnectionStatus();

  // Sync wallet address to Supabase whenever connected
  useWalletAddressSync();

  // Dev bypass: skip auth gate for automated testing
  if (import.meta.env.VITE_DEV_SKIP_AUTH === 'true') return <>{children}</>;

  // While auto-connecting, show a loading state
  if (status === "connecting") {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-black text-zinc-500">
        <p className="text-sm uppercase tracking-[0.2em]">Connecting…</p>
      </div>
    );
  }

  // No wallet connected → show wallet auth surface inline
  if (!account) {
    return <WalletAuthScreen />;
  }

  // Wallet connected → render the app
  return <>{children}</>;
}
