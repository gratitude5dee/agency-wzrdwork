import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletConnectionStatus,
  useDisconnect,
} from "thirdweb/react";
import { WalletAuthScreen } from "@/components/WalletAuth";
import { getServerBaseUrl } from "@/lib/server-api/http";
import { getAccessMe, requestAuthChallenge, verifyAuthChallenge } from "@/lib/server-api/auth";
import { clearServerSessionToken, getServerSessionToken } from "@/lib/server-api/session";

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

function authErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Wallet authorization failed. Please try signing in again.";
}

function WalletAuthorizationError({
  error,
  isRetrying,
  onRetry,
  onDisconnect,
}: {
  error: unknown;
  isRetrying: boolean;
  onRetry: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="dark flex min-h-screen items-center justify-center bg-black px-6 text-zinc-100">
      <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0d1118] p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-sm font-black text-red-300">
            !
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Authorization failed</h1>
            <p className="text-sm text-zinc-500">Your wallet is connected, but the server session was not created.</p>
          </div>
        </div>
        <p className="mb-5 rounded-md border border-white/10 bg-black/30 p-3 text-sm text-zinc-300">
          {authErrorMessage(error)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRetrying ? "Authorizing..." : "Retry signature"}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
          >
            Disconnect wallet
          </button>
        </div>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const account = useActiveAccount();
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
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
    return (
      <WalletAuthorizationError
        error={sessionQuery.error}
        isRetrying={sessionQuery.isFetching}
        onRetry={() => {
          clearServerSessionToken();
          void sessionQuery.refetch();
        }}
        onDisconnect={() => {
          clearServerSessionToken();
          if (wallet) disconnect(wallet);
        }}
      />
    );
  }

  return <>{children}</>;
}
