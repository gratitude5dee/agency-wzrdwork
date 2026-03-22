/**
 * Vercel Serverless API Entry Point
 *
 * Wraps the existing Express app as a single Vercel serverless function.
 * All /api/* requests are routed here by vercel.json rewrites.
 *
 * This avoids rewriting 50+ Express routes — the full Express app
 * (middleware stack, service layer, routes) runs inside each invocation.
 *
 * Adaptations for serverless:
 * - Database connection uses serverless-optimized pooling (see _lib/db.ts)
 * - WebSocket replaced with Supabase Realtime (see _lib/realtime.ts)
 * - No embedded Postgres — always external Supabase
 * - No background intervals — cron jobs handle heartbeat/scheduler
 * - Plugin system initializes lazily per-request
 * - UI serving disabled (frontend deployed separately via Vite/Lovable)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/src/app.js";
import { getDb } from "./_lib/db.js";

// Module-level cache for the Express app across warm invocations
let cachedApp: Awaited<ReturnType<typeof createApp>> | null = null;

async function getApp() {
  if (cachedApp) return cachedApp;

  const db = getDb();

  cachedApp = await createApp(db as any, {
    uiMode: "none",
    serverPort: 443,
    storageService: {
      // S3 or Supabase Storage adapter — configure via env
      async store(_key: string, _data: Buffer) {
        throw new Error("Storage not configured for serverless. Use Supabase Storage or S3.");
      },
      async retrieve(_key: string) {
        throw new Error("Storage not configured for serverless. Use Supabase Storage or S3.");
      },
      async remove(_key: string) {
        throw new Error("Storage not configured for serverless. Use Supabase Storage or S3.");
      },
      getPublicUrl(_key: string) {
        return null;
      },
    },
    deploymentMode: (process.env.DEPLOYMENT_MODE as any) ?? "authenticated",
    deploymentExposure: (process.env.DEPLOYMENT_EXPOSURE as any) ?? "public",
    allowedHostnames: (process.env.ALLOWED_HOSTNAMES ?? "").split(",").filter(Boolean),
    bindHost: "0.0.0.0",
    authReady: true,
    companyDeletionEnabled: process.env.COMPANY_DELETION_ENABLED === "true",
    instanceId: process.env.INSTANCE_ID ?? "vercel-serverless",
    hostVersion: process.env.npm_package_version ?? "0.0.0",
  });

  return cachedApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();
    // Express can handle the raw Node.js request/response
    return app(req as any, res as any);
  } catch (error) {
    console.error("[api/server] handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
