/**
 * Vercel Cron: Sandbox Keepalive
 *
 * Runs every 5 minutes to ensure the control plane sandbox is alive.
 * If the sandbox has stopped (timeout, crash, etc.), this cron will:
 *
 * 1. Check health of the current sandbox
 * 2. If dead, attempt to restore from the latest snapshot
 * 3. If no snapshot, create a fresh sandbox
 * 4. Periodically take snapshots for fast recovery
 *
 * Schedule: *\/5 * * * * (every 5 minutes)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyCronAuth } from "../_lib/cron-auth.js";
import { ensureSandbox, checkSandboxHealth, snapshotSandbox } from "../_lib/sandbox.js";

// Simple in-memory counter for snapshot intervals
let ticksSinceLastSnapshot = 0;
const SNAPSHOT_EVERY_N_TICKS = 12; // Every ~60 minutes (12 * 5min)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req, res)) return;

  try {
    // 1. Check current health
    const health = await checkSandboxHealth();
    console.log(`[cron/sandbox-keepalive] Health check: alive=${health.alive}, id=${health.sandboxId}`);

    if (health.alive) {
      // Sandbox is healthy — periodically snapshot for fast recovery
      ticksSinceLastSnapshot++;

      if (ticksSinceLastSnapshot >= SNAPSHOT_EVERY_N_TICKS) {
        console.log("[cron/sandbox-keepalive] Taking periodic snapshot...");
        const snapshotId = await snapshotSandbox();
        if (snapshotId) {
          ticksSinceLastSnapshot = 0;
          console.log(`[cron/sandbox-keepalive] Snapshot saved: ${snapshotId}`);
        }
      }

      return res.status(200).json({
        ok: true,
        action: "healthy",
        sandbox: health,
        nextSnapshotIn: (SNAPSHOT_EVERY_N_TICKS - ticksSinceLastSnapshot) * 5,
      });
    }

    // 2. Sandbox is down — try to restore
    console.log("[cron/sandbox-keepalive] Sandbox down, attempting recovery...");

    // Try to get the last snapshot ID from environment (set manually or by previous run)
    const lastSnapshotId = process.env.SANDBOX_SNAPSHOT_ID;

    const status = await ensureSandbox(lastSnapshotId);
    ticksSinceLastSnapshot = 0;

    return res.status(status.alive ? 200 : 503).json({
      ok: status.alive,
      action: status.alive ? "recovered" : "failed",
      sandbox: status,
      restoredFrom: lastSnapshotId ?? "fresh",
    });
  } catch (error) {
    console.error("[cron/sandbox-keepalive] error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
