import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveAccount, useActiveWalletConnectionStatus } from "thirdweb/react";
import { WalletAuthScreen } from "@/components/WalletAuth";
import { getServerBaseUrl } from "@/lib/server-api/http";
import { getAccessMe, requestAuthChallenge, verifyAuthChallenge } from "@/lib/server-api/auth";
import { getServerSessionToken } from "@/lib/server-api/session";

async function ensureServerSession(account: { address: string; signMessage: (input: { message: string }) => Promise<string> }) {
  try {
    await getAccessMe();
    return true;
  } catch {
    const challenge = await requestAuthChallenge(account.address);
    const signature = await account.signMessage({ message: challenge.message });
    await verifyAuthChallenge({
      walletAddress: account.address,
      nonce: challenge.nonce,
      message: challenge.message,
      signature,
    });
    return true;
  }
}

export function AuthGate({ children }: { children: ReactNode }) {
  const account = useActiveAccount();
  const status = useActiveWalletConnectionStatus();
  const hasServer = !!getServerBaseUrl();
  const sessionQuery = useQuery({
    queryKey: ["auth-session", account?.address ?? null, getServerSessionToken()],
    enabled: hasServer && !!account?.address && typeof account?.signMessage === "function",
    queryFn: () =>
      ensureServerSession(account as { address: string; signMessage: (input: { message: string }) => Promise<string> }),
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (import.meta.env.VITE_DEV_SKIP_AUTH === "true") {
    return <>{children}</>;
  }

  if (status === "connecting") {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-black text-zinc-500">
        <p className="text-sm uppercase tracking-[0.2em]">Connecting…</p>
      </div>
    );
  }

  if (!account) {
    return <WalletAuthScreen />;
  }

  if (!hasServer) {
    return <>{children}</>;
  }

  if (sessionQuery.isLoading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-black text-zinc-500">
        <p className="text-sm uppercase tracking-[0.2em]">Authorizing…</p>
      </div>
    );
  }

  if (sessionQuery.isError) {
    return <WalletAuthScreen />;
  }

  return <>{children}</>;
}
