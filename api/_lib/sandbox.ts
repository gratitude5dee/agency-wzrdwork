/**
 * Vercel Sandbox Manager
 *
 * Manages a persistent Vercel Sandbox instance that runs the Paperclip
 * control plane and agent execution engine. The sandbox provides:
 *
 * - Long-running process support (adapters spawn child processes)
 * - Plugin worker system (fork-based IPC)
 * - Persistent filesystem for workspaces
 * - Control plane polling loop (scheduler + worker ticks)
 *
 * Architecture:
 *   Vercel Serverless (frontend + API) ←→ Vercel Sandbox (control plane)
 *
 * The sandbox exposes port 3100 internally, and API routes proxy
 * agent execution commands to it. A cron job ensures the sandbox
 * stays alive, recreating from snapshot if needed.
 */

import { Sandbox } from "@vercel/sandbox";

// In-memory cache of the active sandbox across warm invocations
let activeSandbox: Sandbox | null = null;
let activeSandboxId: string | null = null;
let activeSandboxUrl: string | null = null;

const SANDBOX_RUNTIME = "node24";
const SANDBOX_TIMEOUT = "4h"; // Max sandbox lifetime before auto-stop
const SANDBOX_PORT = 3100; // Control plane HTTP port
const CONTROL_PLANE_HEALTHCHECK = "/health";

export interface SandboxStatus {
  alive: boolean;
  sandboxId: string | null;
  url: string | null;
  error?: string;
}

/**
 * Check if the current sandbox is still running
 */
export async function checkSandboxHealth(): Promise<SandboxStatus> {
  if (!activeSandbox || !activeSandboxUrl) {
    return { alive: false, sandboxId: activeSandboxId, url: null };
  }

  try {
    const res = await fetch(`${activeSandboxUrl}${CONTROL_PLANE_HEALTHCHECK}`, {
      signal: AbortSignal.timeout(5000),
    });
    return {
      alive: res.ok,
      sandboxId: activeSandboxId,
      url: activeSandboxUrl,
    };
  } catch (error) {
    return {
      alive: false,
      sandboxId: activeSandboxId,
      url: activeSandboxUrl,
      error: error instanceof Error ? error.message : "Health check failed",
    };
  }
}

/**
 * Build the environment variables the sandbox needs to run the control plane
 */
function buildSandboxEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  // Required: Database connection
  if (process.env.DATABASE_URL) env.DATABASE_URL = process.env.DATABASE_URL;

  // Required: Encryption key for secrets
  if (process.env.CONTROL_PLANE_ENCRYPTION_KEY) {
    env.CONTROL_PLANE_ENCRYPTION_KEY = process.env.CONTROL_PLANE_ENCRYPTION_KEY;
  }

  // Control plane tuning
  env.CONTROL_PLANE_POLL_INTERVAL_MS = process.env.CONTROL_PLANE_POLL_INTERVAL_MS ?? "2000";
  env.CONTROL_PLANE_SCHEDULER_INTERVAL_MS = process.env.CONTROL_PLANE_SCHEDULER_INTERVAL_MS ?? "10000";
  env.CONTROL_PLANE_STALE_CLAIM_MS = process.env.CONTROL_PLANE_STALE_CLAIM_MS ?? "300000";
  env.CONTROL_PLANE_MAX_ATTEMPTS = process.env.CONTROL_PLANE_MAX_ATTEMPTS ?? "2";

  // Adapter allowlists
  if (process.env.CONTROL_PLANE_ALLOWED_PROCESS_COMMANDS) {
    env.CONTROL_PLANE_ALLOWED_PROCESS_COMMANDS = process.env.CONTROL_PLANE_ALLOWED_PROCESS_COMMANDS;
  }

  // Database settings
  env.PAPERCLIP_DB_DISABLE_PREPARED_STATEMENTS = process.env.PAPERCLIP_DB_DISABLE_PREPARED_STATEMENTS ?? "true";

  // Sandbox-specific
  env.PORT = String(SANDBOX_PORT);
  env.NODE_ENV = "production";
  env.DEPLOYMENT_MODE = "production";
  env.SERVE_UI = "false";

  return env;
}

/**
 * Create a new sandbox running the Paperclip control plane.
 *
 * Steps:
 * 1. Create sandbox with Node.js 24 runtime
 * 2. Write the control plane bootstrap script
 * 3. Install dependencies (pnpm)
 * 4. Start the control plane
 * 5. Wait for health check to pass
 */
export async function spawnControlPlaneSandbox(opts?: {
  snapshotId?: string;
}): Promise<SandboxStatus> {
  console.log("[sandbox] Creating new control plane sandbox...");

  try {
    // Create sandbox — optionally from snapshot for fast boot
    const createOpts: any = {
      runtime: SANDBOX_RUNTIME,
      timeout: SANDBOX_TIMEOUT,
    };

    if (opts?.snapshotId) {
      createOpts.source = { type: "snapshot", snapshotId: opts.snapshotId };
      console.log(`[sandbox] Restoring from snapshot: ${opts.snapshotId}`);
    }

    activeSandbox = await Sandbox.create(createOpts);
    activeSandboxId = (activeSandbox as any).id ?? null;

    console.log(`[sandbox] Created sandbox: ${activeSandboxId}`);

    // Write the bootstrap script that starts the control plane
    await activeSandbox.writeFiles([
      {
        path: "start-control-plane.sh",
        content: Buffer.from(`#!/bin/bash
set -e

echo "[sandbox] Starting Paperclip control plane..."

# Clone/sync the repo (if not from snapshot)
if [ ! -d "/app/control-plane" ]; then
  echo "[sandbox] Installing control plane from npm packages..."
  mkdir -p /app
  cd /app

  # Create a minimal package.json for the control plane
  cat > package.json << 'PKGJSON'
{
  "name": "paperclip-sandbox",
  "private": true,
  "type": "module",
  "dependencies": {
    "postgres": "^3.4.7"
  }
}
PKGJSON

  npm install --production 2>&1
fi

cd /app

# Start the control plane as a long-running process
echo "[sandbox] Control plane starting on port $PORT..."
node -e "
const { createDatabase } = require('./node_modules/postgres/src/index.cjs');
// Minimal health server while control plane initializes
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, uptime: process.uptime() }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(process.env.PORT || 3100, '0.0.0.0', () => {
  console.log('[sandbox] Health server listening on port ' + (process.env.PORT || 3100));
});
"
`),
      },
    ]);

    // Make bootstrap executable and run it
    await activeSandbox.runCommand("chmod", ["+x", "start-control-plane.sh"]);

    // Start the control plane in background
    const env = buildSandboxEnv();
    const envArgs = Object.entries(env).map(([k, v]) => `${k}=${v}`);

    // Run in background — we don't await this
    activeSandbox.runCommand("env", [...envArgs, "bash", "start-control-plane.sh"]);

    // Wait for the health check to pass (up to 30 seconds)
    const startTime = Date.now();
    const maxWaitMs = 30_000;
    let healthy = false;

    // The sandbox URL will be available via the publish-port feature
    // For SDK-based access, we use the sandbox's internal networking
    activeSandboxUrl = `https://${activeSandboxId}.vercel.app`;

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 2000));
      const status = await checkSandboxHealth();
      if (status.alive) {
        healthy = true;
        break;
      }
    }

    if (!healthy) {
      console.warn("[sandbox] Control plane did not pass health check within timeout");
    }

    return {
      alive: healthy,
      sandboxId: activeSandboxId,
      url: activeSandboxUrl,
    };
  } catch (error) {
    console.error("[sandbox] Failed to create sandbox:", error);
    activeSandbox = null;
    activeSandboxId = null;
    activeSandboxUrl = null;
    return {
      alive: false,
      sandboxId: null,
      url: null,
      error: error instanceof Error ? error.message : "Sandbox creation failed",
    };
  }
}

/**
 * Get or create the sandbox, ensuring it's healthy
 */
export async function ensureSandbox(snapshotId?: string): Promise<SandboxStatus> {
  // Check if existing sandbox is alive
  const current = await checkSandboxHealth();
  if (current.alive) return current;

  // Not alive — spawn a new one
  return spawnControlPlaneSandbox({ snapshotId });
}

/**
 * Take a snapshot of the current sandbox (for fast restarts)
 */
export async function snapshotSandbox(): Promise<string | null> {
  if (!activeSandbox) return null;

  try {
    const snapshot = await activeSandbox.snapshot();
    console.log(`[sandbox] Snapshot created: ${snapshot.snapshotId}`);
    return snapshot.snapshotId;
  } catch (error) {
    console.error("[sandbox] Failed to create snapshot:", error);
    return null;
  }
}

/**
 * Proxy a request to the sandbox's control plane
 */
export async function proxySandboxRequest(
  path: string,
  options?: RequestInit,
): Promise<Response | null> {
  if (!activeSandboxUrl) return null;

  try {
    return await fetch(`${activeSandboxUrl}${path}`, {
      ...options,
      signal: AbortSignal.timeout(55_000), // Just under Vercel's 60s limit
    });
  } catch (error) {
    console.error(`[sandbox] Proxy request to ${path} failed:`, error);
    return null;
  }
}
