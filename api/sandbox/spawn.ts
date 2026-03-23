/**
 * Vercel API: Sandbox Management
 *
 * POST /api/sandbox/spawn — Create or ensure a running sandbox
 * GET  /api/sandbox/spawn — Check sandbox status
 * PUT  /api/sandbox/spawn — Take a snapshot of the current sandbox
 *
 * Protected by CRON_SECRET (same auth as cron jobs) to prevent
 * unauthorized sandbox creation.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyCronAuth } from "../_lib/cron-auth.js";
import { ensureSandbox, checkSandboxHealth, snapshotSandbox } from "../_lib/sandbox.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // All sandbox management requires auth
  if (!verifyCronAuth(req, res)) return;

  try {
    switch (req.method) {
      case "GET": {
        // Check sandbox health status
        const status = await checkSandboxHealth();
        return res.status(200).json({
          ok: true,
          sandbox: status,
        });
      }

      case "POST": {
        // Spawn or ensure a running sandbox
        const snapshotId = typeof req.body?.snapshotId === "string"
          ? req.body.snapshotId
          : undefined;

        const status = await ensureSandbox(snapshotId);
        return res.status(status.alive ? 200 : 503).json({
          ok: status.alive,
          sandbox: status,
        });
      }

      case "PUT": {
        // Take a snapshot of the current sandbox
        const snapshotId = await snapshotSandbox();
        return res.status(snapshotId ? 200 : 404).json({
          ok: !!snapshotId,
          snapshotId,
        });
      }

      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("[api/sandbox/spawn] error:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
