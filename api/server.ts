/**
 * Vercel Serverless API Entry Point
 *
 * Wraps the existing Express app as a single Vercel serverless function.
 * All /api/* requests are routed here by vercel.json rewrites.
 *
 * Adaptations for serverless:
 * - Database connection uses serverless-optimized pooling (see _lib/db.ts)
 * - WebSocket replaced with Supabase Realtime (see _lib/realtime.ts)
 * - No embedded Postgres — always external Supabase
 * - No background intervals — cron jobs handle heartbeat/scheduler
 * - Plugin system initializes lazily per-request
 * - UI serving disabled (frontend deployed separately via Vite/Lovable)
 *
 * Auth strategy:
 * - Thirdweb wallet auth is the PRIMARY human auth path
 * - Better Auth remains as a compatibility layer for existing board-session flows
 * - Agent auth via JWT/API-key is unchanged
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../server/dist/app.js";
import { getDb, getRawSql } from "./_lib/db.js";

// Module-level cache for the Express app across warm invocations
let cachedApp: Awaited<ReturnType<typeof createApp>> | null = null;

function getWalletAuthConfig() {
  return {
    host: "0.0.0.0",
    port: 443,
    databaseUrl: process.env.DATABASE_URL ?? "",
    allowedOrigin: process.env.ALLOWED_ORIGIN ?? "*",
    trustWalletHeader: process.env.TRUST_WALLET_HEADER === "true",
    websocketPath: "/ws",
    audience: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.PAPERCLIP_PUBLIC_URL ?? "https://localhost"),
    challengeTtlMinutes: Number(process.env.AUTH_CHALLENGE_TTL_MINUTES) || 5,
    sessionTtlDays: Number(process.env.AUTH_SESSION_TTL_DAYS) || 30,
  };
}

async function getApp() {
  if (cachedApp) return cachedApp;

  const db = getDb();
  const rawSql = getRawSql();

  // Better Auth session resolution (compatibility layer)
  let betterAuthHandler: import("express").RequestHandler | undefined;
  let resolveSession: ((req: import("express").Request) => Promise<any>) | undefined;

  try {
    const { createBetterAuthInstance, createBetterAuthHandler, resolveBetterAuthSession } =
      await import("../server/dist/auth/better-auth.js");
    const { loadConfig } = await import("../server/dist/config.js");
    const config = loadConfig();
    const auth = createBetterAuthInstance(db as any, config);
    betterAuthHandler = createBetterAuthHandler(auth);
    resolveSession = (req) => resolveBetterAuthSession(auth, req);
  } catch {
    // Better Auth not available — Thirdweb is the primary path
    console.warn("[api/server] Better Auth not loaded — using Thirdweb wallet auth only");
  }

  cachedApp = await createApp(db as any, {
    uiMode: "none",
    serverPort: 443,
    storageService: {
      // Storage stub — configure via S3/Supabase Storage env vars for production
      async store(_key: string, _data: Buffer) {
        throw new Error("Storage not configured for serverless. Set PAPERCLIP_STORAGE_PROVIDER=s3 with S3 credentials.");
      },
      async retrieve(_key: string) {
        throw new Error("Storage not configured for serverless. Set PAPERCLIP_STORAGE_PROVIDER=s3 with S3 credentials.");
      },
      async remove(_key: string) {
        throw new Error("Storage not configured for serverless. Set PAPERCLIP_STORAGE_PROVIDER=s3 with S3 credentials.");
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
    betterAuthHandler,
    resolveSession,
    walletSessionSql: rawSql,
    walletAuthConfig: getWalletAuthConfig(),
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
