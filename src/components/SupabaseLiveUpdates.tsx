import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { getServerWebSocketUrl } from "@/lib/server-api/http";
import { getServerSessionToken } from "@/lib/server-api/session";

const LIVE_TABLES = [
  "runs",
  "agent_execution_logs",
  "heartbeat_runs",
  "heartbeat_run_events",
] as const;

export function SupabaseLiveUpdates() {
  const queryClient = useQueryClient();
  const { companyId } = useActiveCompany();
  const sessionToken = getServerSessionToken();

  useEffect(() => {
    let timer: number | null = null;
    const invalidate = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => {
        void queryClient.invalidateQueries();
      }, 120);
    };

    const channel = supabase.channel("control-plane-live-updates");
    for (const table of LIVE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        invalidate,
      );
    }
    channel.subscribe();

    const websocketUrl = getServerWebSocketUrl();
    const socket =
      websocketUrl && companyId && sessionToken
        ? new WebSocket(
            `${websocketUrl}?companyId=${encodeURIComponent(companyId)}&sessionToken=${encodeURIComponent(sessionToken)}`,
          )
        : null;

    socket?.addEventListener("message", invalidate);

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      socket?.close();
      void supabase.removeChannel(channel);
    };
  }, [companyId, queryClient, sessionToken]);

  return null;
}
