import type { Sql } from "postgres";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@paperclipai/db", () => ({
  companyMemberships: {},
  instanceUserRoles: {},
  principalPermissionGrants: {},
}));

let walletAuthRoutes: typeof import("../../server/src/routes/auth.js").walletAuthRoutes;
let setWalletSignatureVerifierForTest: typeof import("../../server/src/services/auth.js").setWalletSignatureVerifierForTest;

beforeAll(async () => {
  ({ walletAuthRoutes } = await import("../../server/src/routes/auth.js"));
  ({ setWalletSignatureVerifierForTest } = await import("../../server/src/services/auth.js"));
});

const testConfig = {
  host: "0.0.0.0",
  port: 443,
  databaseUrl: "postgres://test",
  allowedOrigin: "*",
  trustWalletHeader: false,
  websocketPath: "/ws",
  audience: "https://agency-wzrdwork.vercel.app",
  challengeTtlMinutes: 5,
  sessionTtlDays: 30,
};

function createWalletAuthSql() {
  const challenges: Array<{
    id: string;
    wallet_address: string;
    nonce: string;
    message: string;
    expires_at: string;
    consumed_at: string | null;
  }> = [];
  const users = new Map<string, { id: string; wallet_address: string; display_name: string | null }>();
  const sessions: Array<{
    user_id: string;
    wallet_address: string;
    session_token_sha256: string;
    expires_at: string;
  }> = [];

  const sql = vi.fn(async (stringsOrValues: TemplateStringsArray | unknown[], ...values: unknown[]) => {
    if (Array.isArray(stringsOrValues) && !("raw" in stringsOrValues)) return stringsOrValues;

    const query = Array.from(stringsOrValues).join(" ");

    if (query.includes("INSERT INTO public.auth_challenges")) {
      challenges.push({
        id: `challenge-${challenges.length + 1}`,
        wallet_address: values[0] as string,
        nonce: values[1] as string,
        message: values[2] as string,
        expires_at: values[4] as string,
        consumed_at: null,
      });
      return [];
    }

    if (query.includes("FROM public.auth_challenges")) {
      const nonce = values[0] as string;
      const walletAddress = values[1] as string;
      return challenges
        .filter((challenge) => challenge.nonce === nonce && challenge.wallet_address === walletAddress)
        .map((challenge) => ({
          id: challenge.id,
          message: challenge.message,
          expires_at: challenge.expires_at,
          consumed_at: challenge.consumed_at,
        }));
    }

    if (query.includes("UPDATE public.auth_challenges")) {
      const challengeId = values[0] as string;
      const challenge = challenges.find((item) => item.id === challengeId);
      if (challenge) challenge.consumed_at = new Date().toISOString();
      return [];
    }

    if (query.includes("INSERT INTO public.app_users")) {
      const walletAddress = values[0] as string;
      const existing = users.get(walletAddress);
      if (existing) return [existing];
      const user = { id: "00000000-0000-0000-0000-000000000001", wallet_address: walletAddress, display_name: null };
      users.set(walletAddress, user);
      return [user];
    }

    if (query.includes("UPDATE public.companies")) {
      return [];
    }

    if (query.includes("INSERT INTO public.company_memberships")) {
      return [];
    }

    if (query.includes("FROM public.company_memberships")) {
      return [];
    }

    if (query.includes("FROM public.instance_user_roles")) {
      return [];
    }

    if (query.includes("INSERT INTO public.auth_sessions")) {
      sessions.push({
        user_id: values[0] as string,
        wallet_address: values[1] as string,
        session_token_sha256: values[2] as string,
        expires_at: values[3] as string,
      });
      return [];
    }

    throw new Error(`Unhandled SQL in wallet auth test: ${query}`);
  });

  return { sql: sql as unknown as Sql, state: { challenges, sessions, users } };
}

async function callPostRoute(sql: Sql, path: string, body: unknown) {
  const router = walletAuthRoutes({ sql, config: testConfig }) as any;
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.post);
  if (!layer) throw new Error(`Route not registered: POST ${path}`);

  const req = { body } as any;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };

  for (const routeLayer of layer.route.stack) {
    let nextError: unknown;
    const next = (error?: unknown) => {
      nextError = error;
    };
    const result = routeLayer.handle(req, res, next);
    if (result && typeof result.then === "function") await result;
    if (nextError) throw nextError;
  }

  return { status: res.statusCode, body: res.body as Record<string, unknown> };
}

afterEach(() => {
  setWalletSignatureVerifierForTest(null);
});

describe("wallet auth routes", () => {
  it("creates a signed wallet session when verification succeeds", async () => {
    const db = createWalletAuthSql();
    setWalletSignatureVerifierForTest(async () => true);

    const challenge = await callPostRoute(db.sql, "/auth/challenge", {
      walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    });
    expect(challenge.status).toBe(200);

    const verified = await callPostRoute(db.sql, "/auth/verify", {
        walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        nonce: challenge.body?.nonce,
        message: challenge.body?.message,
        signature: "0xsigned",
      });
    expect(verified.status).toBe(200);

    expect(verified.body?.sessionToken).toEqual(expect.any(String));
    expect((verified.body?.actor as any).user.wallet_address).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
    expect(db.state.sessions).toHaveLength(1);
  });

  it("returns 401 when the signature verifier throws", async () => {
    const db = createWalletAuthSql();
    setWalletSignatureVerifierForTest(async () => {
      throw new Error("signature parser failed");
    });

    const challenge = await callPostRoute(db.sql, "/auth/challenge", {
      walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    });
    expect(challenge.status).toBe(200);

    const res = await callPostRoute(db.sql, "/auth/verify", {
        walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        nonce: challenge.body?.nonce,
        message: challenge.body?.message,
        signature: "0xbad",
      });
    expect(res.status).toBe(401);

    expect(res.body).toEqual({ error: "Signature verification failed" });
    expect(db.state.sessions).toHaveLength(0);
  });

  it("returns 401 for mismatched challenge messages", async () => {
    const db = createWalletAuthSql();
    setWalletSignatureVerifierForTest(async () => true);

    const challenge = await callPostRoute(db.sql, "/auth/challenge", {
      walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
    });
    expect(challenge.status).toBe(200);

    const res = await callPostRoute(db.sql, "/auth/verify", {
        walletAddress: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        nonce: challenge.body?.nonce,
        message: `${challenge.body?.message}\nmodified`,
        signature: "0xsigned",
      });
    expect(res.status).toBe(401);

    expect(res.body).toEqual({ error: "Auth challenge message mismatch" });
    expect(db.state.sessions).toHaveLength(0);
  });
});
