/**
 * Supabase Realtime adapter — replaces WebSocket server for serverless.
 *
 * In the original Paperclip architecture, live events are broadcast via
 * a custom WebSocket server (ws library). Vercel serverless functions
 * can't maintain persistent WebSocket connections, so we replace this
 * with Supabase Realtime Broadcast channels.
 *
 * HOW IT WORKS:
 *
 * Server-side (this file):
 *   When a service calls `publishLiveEvent()`, we POST the event to
 *   the Supabase Realtime Broadcast API, which fans it out to all
 *   subscribed clients.
 *
 * Client-side (see realtime-client.ts):
 *   The React frontend subscribes to Supabase Realtime channels
 *   instead of connecting to a WebSocket endpoint. Each company
 *   gets its own channel: `company:{companyId}:events`.
 *
 * This is a drop-in replacement — the event shape is identical,
 * and the frontend just changes its subscription mechanism.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface LiveEvent {
  id?: number;
  companyId: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

/**
 * Publish a live event via Supabase Realtime Broadcast.
 * This replaces the in-memory EventEmitter + WebSocket broadcast.
 */
export async function publishRealtimeEvent(event: LiveEvent): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.warn(
      "[realtime] Supabase Realtime not configured. " +
      "Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable live events."
    );
    return;
  }

  const channelName = `company:${event.companyId}:events`;

  try {
    // Use the Supabase Realtime HTTP broadcast API
    const response = await fetch(
      `${SUPABASE_URL}/realtime/v1/api/broadcast`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          apikey: SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({
          messages: [
            {
              topic: channelName,
              event: "live_event",
              payload: event,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error(
        `[realtime] Broadcast failed: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    console.error("[realtime] Failed to publish event:", error);
  }
}
