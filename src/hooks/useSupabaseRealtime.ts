/**
 * Supabase Realtime hook — replaces WebSocket client for Vercel deployment.
 *
 * Instead of connecting to `/api/companies/:companyId/events/ws`,
 * the frontend subscribes to a Supabase Realtime Broadcast channel.
 *
 * Usage:
 *   const { events, isConnected } = useCompanyRealtimeEvents(companyId);
 *
 * The event shape is identical to what the WebSocket server emits,
 * so existing event handlers work without changes.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Singleton Supabase client for Realtime
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface LiveEvent {
  id?: number;
  companyId: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

type LiveEventHandler = (event: LiveEvent) => void;

/**
 * Subscribe to real-time events for a specific company.
 * Drop-in replacement for the WebSocket-based live event system.
 */
export function useCompanyRealtimeEvents(
  companyId: string | null | undefined,
  onEvent?: LiveEventHandler,
) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!supabase || !companyId) return;

    const channelName = `company:${companyId}:events`;

    const channel = supabase.channel(channelName);

    channel
      .on("broadcast", { event: "live_event" }, (payload) => {
        const event = payload.payload as LiveEvent;
        setLastEvent(event);
        onEventRef.current?.(event);
      })
      .subscribe((status) => {
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [companyId]);

  return { isConnected, lastEvent };
}

/**
 * Subscribe to global events across all companies.
 * Useful for admin dashboards.
 */
export function useGlobalRealtimeEvents(onEvent?: LiveEventHandler) {
  return useCompanyRealtimeEvents("__global__", onEvent);
}
