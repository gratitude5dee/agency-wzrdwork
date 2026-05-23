import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@paperclipai/db", () => ({
  agentApiKeys: {},
  agents: {},
  companyMemberships: {},
  instanceUserRoles: {},
}));

let actorMiddleware: typeof import("../../server/src/middleware/auth.js").actorMiddleware;

beforeAll(async () => {
  ({ actorMiddleware } = await import("../../server/src/middleware/auth.js"));
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createWalletSessionSql(options: { fallbackToPrincipalSchema?: boolean } = {}) {
  const expectedHash = hashToken("wallet-session-token");
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = Array.from(strings).join(" ");

    if (query.includes("FROM public.auth_sessions")) {
      expect(values[0]).toBe(expectedHash);
      return [{
        user_id: "00000000-0000-0000-0000-000000000001",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: null,
      }];
    }

    if (query.includes("UPDATE public.auth_sessions")) {
      return [];
    }

    if (query.includes("FROM public.company_memberships") && query.includes("user_id::text")) {
      if (options.fallbackToPrincipalSchema) {
        throw new Error("column user_id does not exist");
      }
      return [{ company_id: "company-1" }];
    }

    if (query.includes("FROM public.company_memberships") && query.includes("principal_type")) {
      return [{ company_id: "company-2" }];
    }

    if (query.includes("FROM public.instance_user_roles")) {
      return [];
    }

    throw new Error(`Unhandled SQL in wallet-session middleware test: ${query}`);
  });

  return sql as unknown as Sql;
}

async function resolveActor(sql: Sql) {
  const req = {
    actor: undefined,
    header(name: string) {
      if (name.toLowerCase() === "authorization") return "Bearer wallet-session-token";
      return undefined;
    },
  } as any;
  const middleware = actorMiddleware({} as any, {
    deploymentMode: "authenticated",
    walletSessionSql: sql,
  });
  await new Promise<void>((resolve, reject) => {
    middleware(req, {} as any, (error?: unknown) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return req.actor;
}

describe("wallet session actor middleware", () => {
  it("resolves a bearer wallet session from Supabase wallet membership rows", async () => {
    const actor = await resolveActor(createWalletSessionSql());

    expect(actor).toMatchObject({
      type: "board",
      userId: "00000000-0000-0000-0000-000000000001",
      companyIds: ["company-1"],
      isInstanceAdmin: false,
      source: "wallet_session",
    });
  });

  it("falls back to principal membership rows when that schema is present", async () => {
    const actor = await resolveActor(createWalletSessionSql({ fallbackToPrincipalSchema: true }));

    expect(actor).toMatchObject({
      type: "board",
      userId: "00000000-0000-0000-0000-000000000001",
      companyIds: ["company-2"],
      isInstanceAdmin: false,
      source: "wallet_session",
    });
  });
});
