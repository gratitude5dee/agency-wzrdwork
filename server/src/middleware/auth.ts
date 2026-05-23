import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agentApiKeys, agents, companyMemberships, instanceUserRoles } from "@paperclipai/db";
import { verifyLocalAgentJwt } from "../agent-auth-jwt.js";
import type { DeploymentMode } from "@paperclipai/shared";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import type { Sql } from "postgres";
import { logger } from "./logger.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

interface ActorMiddlewareOptions {
  deploymentMode: DeploymentMode;
  resolveSession?: (req: Request) => Promise<BetterAuthSessionResult | null>;
  /**
   * Raw postgres SQL client for resolving Thirdweb wallet sessions.
   * When provided, Bearer tokens are checked against the auth_sessions table
   * (Thirdweb wallet auth) BEFORE falling through to agent API key / JWT auth.
   */
  walletSessionSql?: Sql;
}

interface WalletSessionAccess {
  userId: string;
  companyIds: string[];
  isInstanceAdmin: boolean;
}

/**
 * Try to resolve a Bearer token as a Thirdweb wallet session.
 * Returns board-access details if the token maps to a valid, non-revoked,
 * non-expired wallet session.
 */
async function resolveWalletSession(
  sql: Sql,
  tokenHash: string,
): Promise<WalletSessionAccess | null> {
  try {
    const rows = await sql<{ user_id: string; expires_at: string; revoked_at: string | null }[]>`
      SELECT user_id, expires_at, revoked_at
      FROM public.auth_sessions
      WHERE session_token_sha256 = ${tokenHash}
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || row.revoked_at) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) return null;
    // Touch last_seen_at asynchronously — don't block the request
    sql`UPDATE public.auth_sessions SET last_seen_at = now() WHERE session_token_sha256 = ${tokenHash}`.catch(() => {});
    const [companyIds, isInstanceAdmin] = await Promise.all([
      listWalletSessionCompanyIds(sql, row.user_id),
      isWalletSessionInstanceAdmin(sql, row.user_id),
    ]);
    return { userId: row.user_id, companyIds, isInstanceAdmin };
  } catch (err) {
    logger.warn({ err }, "Failed to resolve wallet session bearer token");
    return null;
  }
}

async function listWalletSessionCompanyIds(sql: Sql, userId: string): Promise<string[]> {
  try {
    const rows = await sql<{ company_id: string }[]>`
      SELECT company_id
      FROM public.company_memberships
      WHERE user_id::text = ${userId}
        AND status = 'active'
    `;
    return rows.map((row) => row.company_id);
  } catch (err) {
    logger.warn(
      { err, userId },
      "Wallet session membership lookup using user_id failed; trying principal membership schema",
    );
  }

  try {
    const rows = await sql<{ company_id: string }[]>`
      SELECT company_id
      FROM public.company_memberships
      WHERE principal_type = 'user'
        AND principal_id = ${userId}
        AND status = 'active'
    `;
    return rows.map((row) => row.company_id);
  } catch (err) {
    logger.warn({ err, userId }, "Wallet session membership lookup failed");
    return [];
  }
}

async function isWalletSessionInstanceAdmin(sql: Sql, userId: string): Promise<boolean> {
  try {
    const rows = await sql<{ id: string }[]>`
      SELECT id
      FROM public.instance_user_roles
      WHERE user_id::text = ${userId}
        AND role IN ('instance_admin', 'admin')
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (err) {
    logger.warn({ err, userId }, "Wallet session instance role lookup failed");
    return false;
  }
}

export function actorMiddleware(db: Db, opts: ActorMiddlewareOptions): RequestHandler {
  return async (req, _res, next) => {
    req.actor =
      opts.deploymentMode === "local_trusted"
        ? { type: "board", userId: "local-board", isInstanceAdmin: true, source: "local_implicit" }
        : { type: "none", source: "none" };

    const runIdHeader = req.header("x-paperclip-run-id");

    const authHeader = req.header("authorization");
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      if (opts.deploymentMode === "authenticated" && opts.resolveSession) {
        let session: BetterAuthSessionResult | null = null;
        try {
          session = await opts.resolveSession(req);
        } catch (err) {
          logger.warn(
            { err, method: req.method, url: req.originalUrl },
            "Failed to resolve auth session from request headers",
          );
        }
        if (session?.user?.id) {
          const userId = session.user.id;
          const [roleRow, memberships] = await Promise.all([
            db
              .select({ id: instanceUserRoles.id })
              .from(instanceUserRoles)
              .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
              .then((rows) => rows[0] ?? null),
            db
              .select({ companyId: companyMemberships.companyId })
              .from(companyMemberships)
              .where(
                and(
                  eq(companyMemberships.principalType, "user"),
                  eq(companyMemberships.principalId, userId),
                  eq(companyMemberships.status, "active"),
                ),
              ),
          ]);
          req.actor = {
            type: "board",
            userId,
            companyIds: memberships.map((row) => row.companyId),
            isInstanceAdmin: Boolean(roleRow),
            runId: runIdHeader ?? undefined,
            source: "session",
          };
          next();
          return;
        }
      }
      if (runIdHeader) req.actor.runId = runIdHeader;
      next();
      return;
    }

    const token = authHeader.slice("bearer ".length).trim();
    if (!token) {
      next();
      return;
    }

    const tokenHash = hashToken(token);

    // --- Primary: Thirdweb wallet session ---
    // Check if the Bearer token is a Thirdweb wallet session before
    // falling through to agent API key / JWT auth.
    if (opts.walletSessionSql) {
      const walletAccess = await resolveWalletSession(opts.walletSessionSql, tokenHash);
      if (walletAccess) {
        req.actor = {
          type: "board",
          userId: walletAccess.userId,
          companyIds: walletAccess.companyIds,
          isInstanceAdmin: walletAccess.isInstanceAdmin,
          runId: runIdHeader ?? undefined,
          source: "wallet_session",
        };
        next();
        return;
      }
    }
    const key = await db
      .select()
      .from(agentApiKeys)
      .where(and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)))
      .then((rows) => rows[0] ?? null);

    if (!key) {
      const claims = verifyLocalAgentJwt(token);
      if (!claims) {
        next();
        return;
      }

      const agentRecord = await db
        .select()
        .from(agents)
        .where(eq(agents.id, claims.sub))
        .then((rows) => rows[0] ?? null);

      if (!agentRecord || agentRecord.companyId !== claims.company_id) {
        next();
        return;
      }

      if (agentRecord.status === "terminated" || agentRecord.status === "pending_approval") {
        next();
        return;
      }

      req.actor = {
        type: "agent",
        agentId: claims.sub,
        companyId: claims.company_id,
        keyId: undefined,
        runId: runIdHeader || claims.run_id || undefined,
        source: "agent_jwt",
      };
      next();
      return;
    }

    await db
      .update(agentApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(agentApiKeys.id, key.id));

    const agentRecord = await db
      .select()
      .from(agents)
      .where(eq(agents.id, key.agentId))
      .then((rows) => rows[0] ?? null);

    if (!agentRecord || agentRecord.status === "terminated" || agentRecord.status === "pending_approval") {
      next();
      return;
    }

    req.actor = {
      type: "agent",
      agentId: key.agentId,
      companyId: key.companyId,
      keyId: key.id,
      runId: runIdHeader || undefined,
      source: "agent_key",
    };

    next();
  };
}

export function requireBoard(req: Express.Request) {
  return req.actor.type === "board";
}
