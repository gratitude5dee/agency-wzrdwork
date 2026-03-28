/**
 * Submission Proof Pack Tests (VAL-CROSS-006)
 *
 * Verifies that the proof pack utility:
 * 1. Assembles manifest, run-log, payment, and route-matrix artifacts
 * 2. Handles partial failures gracefully
 * 3. Route matrix covers all navigable product routes
 * 4. Payment evidence is company-scoped
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

/* ---------- Supabase mock ---------- */

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

/* ---------- Fixtures ---------- */

const COMPANY_ID = "company-proof-001";
const AGENT_ID = "agent-proof-001";
const RUN_ID = "run-proof-001";

const MOCK_IDENTITY = {
  id: "identity-p1",
  agent_id: AGENT_ID,
  company_id: COMPANY_ID,
  operator_wallet: "0xOPERATOR",
  manifest: {
    name: "Proof Agent",
    operator_wallet: "0xOPERATOR",
    erc8004_identity: `erc8004:${AGENT_ID}`,
    supported_tools: ["code_generation"],
    tech_stacks: ["typescript"],
    compute_constraints: { max_iterations: 100, max_tokens_per_run: 200000, budget_usd: 10 },
    task_categories: ["strategy"],
  },
  registered_on_chain: false,
  chain_tx_hash: null,
};

const MOCK_RUN = {
  id: RUN_ID,
  agent_id: AGENT_ID,
  company_id: COMPANY_ID,
  status: "completed",
  created_at: "2025-01-01T00:00:00Z",
  finished_at: "2025-01-01T00:05:00Z",
  summary: "Proof run",
  total_input_tokens: 500,
  total_output_tokens: 200,
  total_cost_usd: 0.02,
};

const MOCK_LOGS = [
  {
    id: "log-p1",
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    run_id: RUN_ID,
    log_type: "decision",
    content: { message: "test" },
    created_at: "2025-01-01T00:01:00Z",
  },
];

const MOCK_INVOICES = [
  {
    id: "invoice-p1",
    company_id: COMPANY_ID,
    agent_id: AGENT_ID,
    seller_wallet: "0xSELLER",
    buyer_wallet: "0xBUYER",
    amount_usdc: 25,
    paid: true,
    tx_hash: "0xTXHASH",
    chain_id: 42161,
    description: "Agent compute",
    paid_at: "2025-01-02T00:00:00Z",
    created_at: "2025-01-01T00:00:00Z",
  },
];

/* ---------- Mock builder ---------- */

function setupFullMock() {
  mockFrom.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    // For agent_invoices, the chain ends with .limit() after .order()
    // For agent_execution_logs, the chain ends with .order() directly
    chain.limit = vi.fn().mockImplementation(() => {
      if (table === "agent_invoices") {
        return Promise.resolve({ data: MOCK_INVOICES, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
    chain.order = vi.fn().mockImplementation(() => {
      if (table === "agent_execution_logs") {
        return Promise.resolve({ data: MOCK_LOGS, error: null });
      }
      // For agent_invoices, order returns the chain so .limit() can be called
      return chain;
    });
    chain.maybeSingle = vi.fn().mockImplementation(() => {
      if (table === "agent_identities") {
        return Promise.resolve({ data: MOCK_IDENTITY, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    chain.single = vi.fn().mockImplementation(() => {
      if (table === "runs") {
        return Promise.resolve({ data: MOCK_RUN, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    return chain;
  });
}

/* ---------- Tests ---------- */

describe("ROUTE_MATRIX", () => {
  it("contains all expected navigable routes", async () => {
    const { ROUTE_MATRIX } = await import("@/lib/proof-pack");

    const paths = ROUTE_MATRIX.map((r) => r.path);

    // Core routes from left-nav
    expect(paths).toContain("/cockpit");
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/agents");
    expect(paths).toContain("/integrations");
    expect(paths).toContain("/settings");
    expect(paths).toContain("/org-chart");
    expect(paths).toContain("/skills");
    expect(paths).toContain("/delegations");
    expect(paths).toContain("/issues");
    expect(paths).toContain("/approvals");
    expect(paths).toContain("/projects");
    expect(paths).toContain("/costs");
    expect(paths).toContain("/activity");
    expect(paths).toContain("/inbox");
    expect(paths).toContain("/goals");
    expect(paths).toContain("/agents/new");
  });

  it("every route has a label and section", async () => {
    const { ROUTE_MATRIX } = await import("@/lib/proof-pack");

    for (const route of ROUTE_MATRIX) {
      expect(route.label).toBeTruthy();
      expect(route.section).toBeTruthy();
      expect(route.path.startsWith("/")).toBe(true);
    }
  });
});

describe("getPaymentEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retrieves invoices for the given company", async () => {
    setupFullMock();
    const { getPaymentEvidence } = await import("@/lib/proof-pack");

    const payments = await getPaymentEvidence(COMPANY_ID);

    expect(payments).toHaveLength(1);
    expect(payments[0].company_id).toBe(COMPANY_ID);
    expect(payments[0].paid).toBe(true);
    expect(payments[0].tx_hash).toBe("0xTXHASH");
  });

  it("returns empty array when no invoices exist", async () => {
    mockFrom.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue({ data: [], error: null });
      return chain;
    });

    const { getPaymentEvidence } = await import("@/lib/proof-pack");
    const payments = await getPaymentEvidence("no-invoices");
    expect(payments).toHaveLength(0);
  });

  it("throws on Supabase error", async () => {
    mockFrom.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
      return chain;
    });

    const { getPaymentEvidence } = await import("@/lib/proof-pack");
    await expect(getPaymentEvidence(COMPANY_ID)).rejects.toThrow("Failed to fetch payment evidence");
  });
});

describe("assembleProofPack", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assembles all four artifact types when IDs are provided", async () => {
    setupFullMock();
    const { assembleProofPack } = await import("@/lib/proof-pack");

    const pack = await assembleProofPack(COMPANY_ID, AGENT_ID, RUN_ID);

    // Manifest
    expect(pack.manifest).not.toBeNull();
    expect(pack.manifest?.agent_id).toBe(AGENT_ID);
    expect(pack.manifestError).toBeNull();

    // Run log
    expect(pack.runLog).not.toBeNull();
    expect(pack.runLog?.run_id).toBe(RUN_ID);
    expect(pack.runLogError).toBeNull();

    // Payments
    expect(pack.payments).toHaveLength(1);
    expect(pack.paymentsError).toBeNull();

    // Route matrix
    expect(pack.routeMatrix.length).toBeGreaterThan(0);

    // Metadata
    expect(pack.companyId).toBe(COMPANY_ID);
    expect(pack.assembledAt).toBeTruthy();
  });

  it("records errors for missing agent ID without blocking other artifacts", async () => {
    setupFullMock();
    const { assembleProofPack } = await import("@/lib/proof-pack");

    const pack = await assembleProofPack(COMPANY_ID, null, RUN_ID);

    expect(pack.manifest).toBeNull();
    expect(pack.manifestError).toContain("No agent selected");
    // Run log should still work
    expect(pack.runLog).not.toBeNull();
    // Payments should still work
    expect(pack.payments).toHaveLength(1);
  });

  it("records errors for missing run ID without blocking other artifacts", async () => {
    setupFullMock();
    const { assembleProofPack } = await import("@/lib/proof-pack");

    const pack = await assembleProofPack(COMPANY_ID, AGENT_ID, null);

    expect(pack.runLog).toBeNull();
    expect(pack.runLogError).toContain("No run selected");
    // Manifest should still work
    expect(pack.manifest).not.toBeNull();
  });

  it("includes the route matrix regardless of other failures", async () => {
    setupFullMock();
    const { assembleProofPack } = await import("@/lib/proof-pack");

    const pack = await assembleProofPack(COMPANY_ID);

    expect(pack.routeMatrix.length).toBeGreaterThan(10);
  });

  it("captures manifest retrieval errors gracefully", async () => {
    mockFrom.mockImplementation((table: string) => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockImplementation(() => {
        return Promise.resolve({ data: [], error: null });
      });
      chain.order = vi.fn().mockImplementation(() => {
        if (table === "agent_execution_logs") {
          return Promise.resolve({ data: [], error: null });
        }
        // For invoices and other tables, return chain so .limit() can be called
        return chain;
      });
      chain.maybeSingle = vi.fn().mockImplementation(() => {
        if (table === "agent_identities") {
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
      chain.single = vi.fn().mockImplementation(() => {
        if (table === "runs") {
          return Promise.resolve({ data: MOCK_RUN, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    });

    const { assembleProofPack } = await import("@/lib/proof-pack");
    const pack = await assembleProofPack(COMPANY_ID, "bad-agent", RUN_ID);

    expect(pack.manifest).toBeNull();
    expect(pack.manifestError).toBeTruthy();
    // Other artifacts should still be present
    expect(pack.runLog).not.toBeNull();
  });

  it("proof pack company_id matches the requested company", async () => {
    setupFullMock();
    const { assembleProofPack } = await import("@/lib/proof-pack");

    const pack = await assembleProofPack(COMPANY_ID, AGENT_ID, RUN_ID);

    expect(pack.companyId).toBe(COMPANY_ID);
    expect(pack.manifest?.company_id).toBe(COMPANY_ID);
    expect(pack.runLog?.company_id).toBe(COMPANY_ID);
    for (const p of pack.payments) {
      expect(p.company_id).toBe(COMPANY_ID);
    }
  });
});
