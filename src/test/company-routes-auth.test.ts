import { beforeEach, describe, expect, it, vi } from "vitest";
import { companyRoutes } from "../../server/src/routes/companies.js";

const serviceMocks = vi.hoisted(() => ({
  companyList: vi.fn(),
  companyCreate: vi.fn(),
  companyUpdate: vi.fn(),
  companyRemove: vi.fn(),
  ensureMembership: vi.fn(),
  upsertPolicy: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("../../server/src/services/index.js", () => ({
  companyService: () => ({
    list: serviceMocks.companyList,
    stats: vi.fn(),
    getById: vi.fn(),
    create: serviceMocks.companyCreate,
    update: serviceMocks.companyUpdate,
    archive: vi.fn(),
    remove: serviceMocks.companyRemove,
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

function createMockWalletSql(options: { legacyCompanies?: boolean } = {}) {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const legacyCompany = {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Legacy Company",
    slug: "legacy-company",
    description: "Legacy description",
    brief: "Legacy description",
    company_type: "agency",
    brand_color: "#f97316",
    wallet_address: "0xabc",
    created_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    updated_at: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  };
  const sql = vi.fn((stringsOrValue: TemplateStringsArray | Record<string, unknown>, ...values: unknown[]) => {
    if (!Array.isArray(stringsOrValue) || !("raw" in stringsOrValue)) {
      calls.push({ query: "helper", values: [stringsOrValue, ...values] });
      return { helper: true };
    }

    const query = Array.from(stringsOrValue).join("?");
    calls.push({ query, values });
    if (options.legacyCompanies && query.includes("information_schema.columns")) {
      return Promise.resolve([
        { column_name: "id", is_nullable: "NO", column_default: "gen_random_uuid()" },
        { column_name: "name", is_nullable: "NO", column_default: null },
        { column_name: "description", is_nullable: "NO", column_default: null },
        { column_name: "brief", is_nullable: "NO", column_default: null },
        { column_name: "company_type", is_nullable: "NO", column_default: null },
        { column_name: "slug", is_nullable: "NO", column_default: null },
        { column_name: "brand_color", is_nullable: "NO", column_default: "'#f97316'::text" },
        { column_name: "wallet_address", is_nullable: "YES", column_default: null },
        { column_name: "created_at", is_nullable: "NO", column_default: "now()" },
        { column_name: "updated_at", is_nullable: "NO", column_default: "now()" },
      ]);
    }
    if (options.legacyCompanies && query.includes("INSERT INTO public.companies")) {
      return Promise.resolve([legacyCompany]);
    }
    if (options.legacyCompanies && query.includes("SELECT *") && query.includes("FROM public.companies")) {
      return Promise.resolve([legacyCompany]);
    }
    return Promise.resolve([]);
  });
  return { sql, calls };
}

async function callCompanyList(
  actor: Record<string, unknown>,
  opts: Parameters<typeof companyRoutes>[1] = {},
) {
  const router = companyRoutes({} as any, opts) as any;
  const layer = router.stack.find(
    (entry: any) => entry.route?.path === "/" && entry.route?.methods?.get,
  );
  if (!layer) throw new Error("GET / company route was not registered");

  const req = { actor } as any;
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
    serviceMocks.companyList.mockResolvedValue([]);
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

  it("lists wallet-session companies through the legacy wallet schema", async () => {
    const walletSql = createMockWalletSql({ legacyCompanies: true });
    const res = await callCompanyList({
      type: "board",
      userId: "user-1",
      companyIds: ["11111111-1111-1111-1111-111111111111"],
      isInstanceAdmin: false,
      source: "wallet_session",
    }, { walletSessionSql: walletSql.sql as any });

    expect(res.status).toBe(200);
    expect(serviceMocks.companyList).not.toHaveBeenCalled();
    expect(res.body).toEqual([
      expect.objectContaining({
        id: "11111111-1111-1111-1111-111111111111",
        name: "Legacy Company",
        walletAddress: "0xabc",
        wallet_address: "0xabc",
      }),
    ]);
  });

  it("falls back to legacy company creation when the Drizzle company shape is ahead of production", async () => {
    serviceMocks.companyCreate.mockRejectedValueOnce(new Error("column status does not exist"));
    const walletSql = createMockWalletSql({ legacyCompanies: true });
    const res = await callCompanyCreate({
      type: "board",
      userId: "user-1",
      companyIds: [],
      isInstanceAdmin: false,
      source: "wallet_session",
    }, { name: "Legacy Company", walletAddress: "0xabc" }, { walletSessionSql: walletSql.sql as any });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(expect.objectContaining({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Legacy Company",
      walletAddress: "0xabc",
    }));
    expect(walletSql.calls.some((call) => call.query.includes("information_schema.columns"))).toBe(true);
    expect(walletSql.calls.some((call) => call.query.includes("INSERT INTO public.companies"))).toBe(true);
    expect(walletSql.calls.some((call) => call.query.includes("INSERT INTO public.company_memberships"))).toBe(true);
  });
});
