/**
 * Vercel Cron: Reap Orphaned Runs
 *
 * Runs every 5 minutes to clean up heartbeat runs that were
 * claimed by a previous serverless invocation but never completed
 * (e.g., due to function timeout or cold start failure).
 *
 * Original: server/src/index.ts → periodic reapOrphanedRuns()
 * Schedule: */5 * * * * (every 5 minutes)
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

    // Reap runs stale for 5+ minutes (likely from timed-out serverless functions)
    await heartbeat.reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 });

    // Resume any queued runs that were waiting
    await heartbeat.resumeQueuedRuns();

    res.status(200).json({
      ok: true,
      cron: "reap-orphans",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/reap-orphans] error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
