/**
 * Thirdweb wallet authentication routes (Express Router).
 *
 * Provides SIWE-based challenge/verify auth flow as the primary
 * human authentication path. Better Auth remains as a compatibility
 * layer for existing Paperclip board-session flows.
 *
 * Flow:
 * 1. POST /api/auth/challenge  → get SIWE message to sign
 * 2. POST /api/auth/verify     → verify signature, get session token
 * 3. GET  /api/auth/session    → get current session info
 * 4. POST /api/auth/logout     → revoke session token
 */
import { Router } from "express";
import type { Sql } from "postgres";
import {
  createAuthChallenge,
  verifyAuthChallenge,
  authenticateRequest,
  readSessionTokenFromRequest,
  resolveAccessPayload,
  revokeSessionToken,
} from "../services/auth.js";
import type { ServerConfig } from "../types.js";

export interface WalletAuthRouteOptions {
  sql: Sql;
  config: ServerConfig;
}

export function walletAuthRoutes(opts: WalletAuthRouteOptions) {
  const router = Router();

  router.post("/auth/challenge", async (req, res) => {
    try {
      const walletAddress = typeof req.body?.walletAddress === "string" ? req.body.walletAddress : null;
      if (!walletAddress) {
        res.status(400).json({ error: "walletAddress is required" });
        return;
      }
      const challenge = await createAuthChallenge(opts.sql, opts.config, walletAddress);
      res.json(challenge);
    } catch (err: any) {
      const status = err.statusCode ?? err.status ?? 500;
      res.status(status).json({ error: err.message ?? "Internal error" });
    }
  });

  router.post("/auth/verify", async (req, res) => {
    try {
      const result = await verifyAuthChallenge(opts.sql, opts.config, {
        walletAddress: typeof req.body?.walletAddress === "string" ? req.body.walletAddress : "",
        nonce: typeof req.body?.nonce === "string" ? req.body.nonce : "",
        message: typeof req.body?.message === "string" ? req.body.message : "",
        signature: typeof req.body?.signature === "string" ? req.body.signature : "",
      });
      res.json(result);
    } catch (err: any) {
      const status = err.statusCode ?? err.status ?? 500;
      res.status(status).json({ error: err.message ?? "Internal error" });
    }
  });

  router.get("/auth/session", async (req, res) => {
    try {
      const companyId = typeof req.query.companyId === "string" ? req.query.companyId : null;
      const { actor } = await authenticateRequest(opts.sql, opts.config, req);
      const payload = await resolveAccessPayload(opts.sql, actor, companyId);
      res.json(payload);
    } catch (err: any) {
      const status = err.statusCode ?? err.status ?? 500;
      res.status(status).json({ error: err.message ?? "Internal error" });
    }
  });

  router.post("/auth/logout", async (req, res) => {
    try {
      const sessionToken = readSessionTokenFromRequest(req);
      if (sessionToken) {
        await revokeSessionToken(opts.sql, sessionToken);
      }
      res.status(204).end();
    } catch (err: any) {
      const status = err.statusCode ?? err.status ?? 500;
      res.status(status).json({ error: err.message ?? "Internal error" });
    }
  });

  return router;
}
