import type { ReactNode } from "react";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import { Navigate, useLocation } from "react-router-dom";
import { useWalletAddressSync } from "@/hooks/useWalletAddressSync";

/**
 * Auth gate: redirects to /auth when no wallet is connected.
 * Once connected, renders children (the main app) and syncs the wallet
 * address to Supabase companies table.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const account = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const location = useLocation();

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

  // No wallet connected → redirect to auth page
  if (!account) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Wallet connected → render the app
  return <>{children}</>;
}
