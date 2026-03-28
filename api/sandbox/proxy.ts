/**
 * Vercel API: Sandbox Proxy
 *
 * Proxies requests from Vercel serverless functions to the running
 * Vercel Sandbox that hosts the control plane.
 *
 * Routes: /api/sandbox/proxy/* → sandbox:3100/*
 *
 * This enables the serverless API layer to delegate agent execution,
 * adapter management, and plugin operations to the persistent sandbox
 * where those long-running processes can actually work.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { proxySandboxRequest, checkSandboxHealth } from "../_lib/sandbox.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Extract the path after /api/sandbox/proxy/
  const proxyPath = Array.isArray(req.query.path)
    ? `/${req.query.path.join("/")}`
    : req.query.path
      ? `/${req.query.path}`
      : "/";

  // Check if sandbox is alive
  const status = await checkSandboxHealth();
  if (!status.alive) {
    return res.status(503).json({
      error: "Control plane sandbox is not running",
      hint: "POST /api/sandbox/spawn to start it",
      sandboxId: status.sandboxId,
    });
  }

  try {
    // Build request options
    const headers: Record<string, string> = {
      "content-type": req.headers["content-type"] ?? "application/json",
    };

    // Forward auth headers
    if (req.headers.authorization) {
      headers.authorization = req.headers.authorization;
    }

    const fetchOpts: RequestInit = {
      method: req.method ?? "GET",
      headers,
    };

    // Forward body for non-GET requests
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const proxyRes = await proxySandboxRequest(proxyPath, fetchOpts);

    if (!proxyRes) {
      return res.status(502).json({
        error: "Failed to reach control plane sandbox",
      });
    }

    // Forward response
    const contentType = proxyRes.headers.get("content-type") ?? "application/json";
    const body = await proxyRes.text();

    res.status(proxyRes.status);
    res.setHeader("content-type", contentType);
    res.setHeader("x-sandbox-id", status.sandboxId ?? "unknown");
    return res.send(body);
  } catch (error) {
    console.error(`[api/sandbox/proxy] error proxying ${proxyPath}:`, error);
    res.status(502).json({
      error: "Proxy error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
