/**
 * Vercel Cron: Heartbeat Scheduler Tick
 *
 * Replaces the control plane's `schedulerTick()` loop.
 * Runs every minute via Vercel Cron to check which agents have heartbeats
 * due and enqueue wakeup requests.
 *
 * Original: control-plane/src/service.ts → schedulerTick()
 * Schedule: * * * * * (every minute)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyCronAuth } from "../_lib/cron-auth.js";
import { getDb } from "../_lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req, res)) return;

  try {
    const db = getDb();

    // Import the heartbeat service and run the timer tick
    // This checks all agents with heartbeat configs and enqueues wakeups
    const { heartbeatService } = await import("../../server/dist/services/heartbeat.js");
    const heartbeat = heartbeatService(db as any);

    const result = await heartbeat.tickTimers(new Date());

    res.status(200).json({
      ok: true,
      cron: "heartbeat-scheduler",
      timestamp: new Date().toISOString(),
      enqueued: result.enqueued,
    });
  } catch (error) {
    console.error("[cron/heartbeat-scheduler] error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
