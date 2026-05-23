import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../../server/src/routes/companies.js";

const serviceMocks = vi.hoisted(() => ({
  companyCreate: vi.fn(),
  ensureMembership: vi.fn(),
  upsertPolicy: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("../../server/src/services/index.js", () => ({
  companyService: () => ({
    list: vi.fn(),
    stats: vi.fn(),
    getById: vi.fn(),
    create: serviceMocks.companyCreate,
    update: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
  }),
  companyPortabilityService: () => ({
    exportBundle: vi.fn(),
    previewImport: vi.fn(),
    importBundle: vi.fn(),
  }),
  accessService: () => ({
    canUser: vi.fn(),
    ensureMembership: serviceMocks.ensureMembership,
  }),
  budgetService: () => ({
    upsertPolicy: serviceMocks.upsertPolicy,
  }),
  logActivity: serviceMocks.logActivity,
}));

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (body: unknown) => MockResponse;
};

function createMockWalletSql() {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ query: Array.from(strings).join("?"), values });
    return Promise.resolve([]);
  });
  return { sql, calls };
}

async function callCompanyCreate(
  actor: Record<string, unknown>,
  body: unknown,
  opts: Parameters<typeof companyRoutes>[1] = {},
) {
  const router = companyRoutes({} as any, opts) as any;
  const layer = router.stack.find(
    (entry: any) => entry.route?.path === "/" && entry.route?.methods?.post,
  );
  if (!layer) throw new Error("POST / company route was not registered");

  const req = { actor, body } as any;
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  for (const routeLayer of layer.route.stack) {
    try {
      let nextError: unknown;
      const next = (error?: unknown) => {
        nextError = error;
      };
      const result = routeLayer.handle(req, res, next);
      if (result && typeof result.then === "function") await result;
      if (nextError) throw nextError;
    } catch (error) {
      const httpError = error as { status?: number; statusCode?: number; message?: string };
      res.status(httpError.status ?? httpError.statusCode ?? 500).json({
        error: httpError.message ?? "Internal error",
      });
      break;
    }
  }

  return { status: res.statusCode, body: res.body };
}

describe("company creation auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.companyCreate.mockResolvedValue({
      id: "company-1",
      name: "My Company",
      budgetMonthlyCents: 0,
    });
  });

  it("rejects company creation without a signed board session", async () => {
    const res = await callCompanyCreate({
      type: "none",
      source: "none",
    }, { name: "My Company", walletAddress: "0xabc" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Board access required" });
    expect(serviceMocks.companyCreate).not.toHaveBeenCalled();
    expect(serviceMocks.ensureMembership).not.toHaveBeenCalled();
  });

  it("lets a signed non-admin board user create a company", async () => {
    const walletSql = createMockWalletSql();
    const res = await callCompanyCreate({
      type: "board",
      userId: "user-1",
      companyIds: [],
      isInstanceAdmin: false,
      source: "wallet_session",
    }, { name: "My Company", walletAddress: "0xabc" }, { walletSessionSql: walletSql.sql as any });

    expect(res.status).toBe(201);
    expect(serviceMocks.companyCreate).toHaveBeenCalledWith({
      name: "My Company",
      walletAddress: "0xabc",
      budgetMonthlyCents: 0,
    });
    expect(res.body).toMatchObject({ id: "company-1", name: "My Company" });
    expect(serviceMocks.ensureMembership).not.toHaveBeenCalled();
  });

  it("grants owner membership to the signed wallet creator", async () => {
    const walletSql = createMockWalletSql();
    await callCompanyCreate({
      type: "board",
      userId: "user-1",
      companyIds: [],
      isInstanceAdmin: false,
      source: "wallet_session",
    }, { name: "My Company", walletAddress: "0xabc" }, { walletSessionSql: walletSql.sql as any });

    expect(walletSql.calls[0]?.query).toContain("INSERT INTO public.company_memberships");
    expect(walletSql.calls[0]?.values).toContain("company-1");
    expect(walletSql.calls[0]?.values).toContain("user-1");
    expect(serviceMocks.ensureMembership).not.toHaveBeenCalled();
  });
});
