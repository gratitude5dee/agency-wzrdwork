import express from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { companyRoutes } from "../routes/companies.js";

const serviceMocks = vi.hoisted(() => ({
  companyCreate: vi.fn(),
  ensureMembership: vi.fn(),
  upsertPolicy: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("../services/index.js", () => ({
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

function makeApp(actor: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).actor = actor;
    next();
  });
  app.use("/api/companies", companyRoutes({} as any));
  return app;
}

async function requestApp(
  app: express.Express,
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("company routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.companyCreate.mockResolvedValue({
      id: "company-1",
      name: "My Company",
      budgetMonthlyCents: 0,
    });
  });

  it("returns a clear error when companyId is missing for issues list path", async () => {
    const app = makeApp({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
      source: "agent_key",
    });

    const res = await requestApp(app, "/api/companies/issues");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Missing companyId in path. Use /api/companies/{companyId}/issues.",
    });
  });

  it("lets an authenticated board user create their first company and become owner", async () => {
    const app = makeApp({
      type: "board",
      userId: "user-1",
      companyIds: [],
      isInstanceAdmin: false,
      source: "wallet_session",
    });

    const res = await requestApp(app, "/api/companies", {
      method: "POST",
      body: { name: "My Company", walletAddress: "0xabc" },
    });

    expect(res.status).toBe(201);
    expect(serviceMocks.companyCreate).toHaveBeenCalledWith({
      name: "My Company",
      walletAddress: "0xabc",
      budgetMonthlyCents: 0,
    });
    expect(serviceMocks.ensureMembership).toHaveBeenCalledWith(
      "company-1",
      "user",
      "user-1",
      "owner",
      "active",
    );
    expect(res.body).toMatchObject({ id: "company-1", name: "My Company" });
  });
});
