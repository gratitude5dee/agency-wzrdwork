/**
 * Vercel Cron: Heartbeat Worker Tick
 *
 * Replaces the control plane's `workerTick()` loop.
 * Runs every minute via Vercel Cron to claim and process pending
 * wakeup requests (agent heartbeats).
 *
 * Original: control-plane/src/service.ts → workerTick()
 * Schedule: * * * * * (every minute)
 *
 * NOTE: In serverless, each invocation can process ONE wakeup within
 * the function timeout (60s max on Vercel Pro, 10s on Hobby).
 * For high-throughput, consider upgrading to Vercel Pro for longer
 * function durations, or using Vercel's `maxDuration` config.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyCronAuth } from "../_lib/cron-auth.js";
import { getDb } from "../_lib/db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req, res)) return;

  try {
    const db = getDb();

    const { heartbeatService } = await import("../../server/dist/services/index.js");
    const heartbeat = heartbeatService(db as any);

    // Resume any queued runs that need processing
    await heartbeat.resumeQueuedRuns();

    res.status(200).json({
      ok: true,
      cron: "heartbeat-worker",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/heartbeat-worker] error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
