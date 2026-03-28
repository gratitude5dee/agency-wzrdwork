import { createThirdwebClient, type ThirdwebClient } from "thirdweb";
import { ThirdwebProvider as ThirdwebSDKProvider } from "thirdweb/react";
import { arbitrum, celo } from "thirdweb/chains";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Supported chains: Arbitrum (x402 payments) + Celo (stablecoin txns). */
export const supportedChains = [arbitrum, celo] as const;

/**
 * Context so any component can access the thirdweb client once loaded.
 */
const ThirdwebClientContext = createContext<ThirdwebClient | null>(null);

export function useThirdwebClient() {
  return useContext(ThirdwebClientContext);
}

/**
 * Exported client reference — set once the edge function responds.
 * Components that import this directly should handle null.
 */
export let thirdwebClient: ThirdwebClient | null = null;

/**
 * Wraps children with the thirdweb React provider.
 * Fetches the publishable client ID from the thirdweb-config edge function
 * (which reads the Supabase secret) at startup.
 */
export function ThirdwebProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ThirdwebClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("thirdweb-config");

        if (cancelled) return;

        if (fnError || !data?.clientId) {
          setError(
            fnError?.message ??
              data?.error ??
              "Failed to load thirdweb configuration"
          );
          setLoading(false);
          return;
        }

        const tw = createThirdwebClient({ clientId: data.clientId });
        thirdwebClient = tw;
        setClient(tw);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <p className="text-sm uppercase tracking-[0.2em]">Loading…</p>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="dark flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-2xl">
          ⚠️
        </div>
        <h1 className="text-xl font-bold uppercase tracking-widest">Configuration Error</h1>
        <p className="max-w-md text-center text-sm text-muted-foreground">
          {error ?? "Thirdweb client ID could not be loaded."}
        </p>
        <p className="text-xs text-muted-foreground">
          Ensure{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VITE_THIRDWEB_CLIENT_ID</code>{" "}
          is set in your Edge Function secrets.
        </p>
      </div>
    );
  }

  return (
    <ThirdwebClientContext.Provider value={client}>
      <ThirdwebSDKProvider>{children}</ThirdwebSDKProvider>
    </ThirdwebClientContext.Provider>
  );
}
