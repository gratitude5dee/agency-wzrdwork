/**
 * Vercel Cron Job authentication guard.
 *
 * Vercel sends a secret header `Authorization: Bearer <CRON_SECRET>` with
 * each cron invocation. This utility verifies it to prevent unauthorized
 * access to the cron endpoints.
 *
 * @see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

export function verifyCronAuth(req: VercelRequest, res: VercelResponse): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow unauthenticated cron calls
  if (!cronSecret && process.env.VERCEL_ENV !== "production") {
    return true;
  }

  if (!cronSecret) {
    res.status(500).json({ error: "CRON_SECRET not configured" });
    return false;
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}
