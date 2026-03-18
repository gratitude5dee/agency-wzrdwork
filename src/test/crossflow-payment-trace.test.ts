/**
 * VAL-CROSS-004: Payment proof traces back to the owning company,
 * agent, and runtime artifacts
 *
 * Tests that an invoice settlement can be traced through shared visible
 * identifiers to its owning company, agent, and any related run,
 * finance, or log artifacts without hidden manual correlation.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

/* ---------- Supabase mock ---------- */

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

/* ---------- Fixtures ---------- */

const COMPANY_ID = "company-cross-004";
const AGENT_ID = "agent-cross-004";
const INVOICE_ID = "invoice-cross-004";
const RUN_ID = "run-cross-004";

const PAID_INVOICE = {
  id: INVOICE_ID,
  company_id: COMPANY_ID,
  agent_id: AGENT_ID,
  seller_wallet: "0xSELLER",
  buyer_wallet: "0xBUYER",
  amount_usdc: 25.0,
  paid: true,
  tx_hash: "0xTX_PROOF",
  chain_id: 42161,
  paid_at: "2025-01-02T00:00:00Z",
  description: "Agent compute services",
};

const COMPANY = {
  id: COMPANY_ID,
  name: "Crossflow Test Co",
  slug: "crossflow-test",
  wallet_address: "0xCOMPANY_WALLET",
};

const AGENT = {
  id: AGENT_ID,
  name: "Finance Agent",
  role: "department_lead",
  company_id: COMPANY_ID,
};

const RUNS = [
  {
    id: RUN_ID,
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    status: "completed",
    summary: "Process invoice payment",
    created_at: "2025-01-01T12:00:00Z",
  },
];

const EXECUTION_LOGS = [
  {
    id: "log-p1",
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    run_id: RUN_ID,
    log_type: "output",
    created_at: "2025-01-01T12:01:00Z",
  },
];

/* ---------- Mock builder ---------- */

function setupMock(opts?: {
  invoice?: typeof PAID_INVOICE | null;
  company?: typeof COMPANY | null;
  agent?: typeof AGENT | null;
  runs?: typeof RUNS;
  logs?: typeof EXECUTION_LOGS;
  agentCompanyMismatch?: boolean;
}) {
  const invoiceData = opts?.invoice !== undefined ? opts.invoice : PAID_INVOICE;
  const companyData = opts?.company !== undefined ? opts.company : COMPANY;
  const agentData = opts?.agent !== undefined ? opts.agent : AGENT;

  mockFrom.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockImplementation(() => {
      if (table === "runs") return Promise.resolve({ data: opts?.runs ?? RUNS, error: null });
      if (table === "agent_execution_logs")
        return Promise.resolve({ data: opts?.logs ?? EXECUTION_LOGS, error: null });
      return Promise.resolve({ data: [], error: null });
    });
    chain.maybeSingle = vi.fn().mockImplementation(() => {
      if (table === "agent_invoices") {
        return Promise.resolve({ data: invoiceData, error: null });
      }
      if (table === "companies") {
        return Promise.resolve({ data: companyData, error: null });
      }
      if (table === "agents") {
        if (opts?.agentCompanyMismatch && agentData) {
          return Promise.resolve({
            data: { ...agentData, company_id: "WRONG-COMPANY" },
            error: null,
          });
        }
        return Promise.resolve({ data: agentData, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    return chain;
  });
}

/* ---------- Tests ---------- */

describe("VAL-CROSS-004: Payment → Company/Agent/Runtime trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("traces a paid invoice to its owning company, agent, and runtime artifacts", async () => {
    setupMock();
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.invoice).not.toBeNull();
    expect(trace.invoice?.id).toBe(INVOICE_ID);
    expect(trace.invoice?.paid).toBe(true);
    expect(trace.invoice?.tx_hash).toBe("0xTX_PROOF");
    expect(trace.company).not.toBeNull();
    expect(trace.company?.id).toBe(COMPANY_ID);
    expect(trace.agent).not.toBeNull();
    expect(trace.agent?.id).toBe(AGENT_ID);
    expect(trace.relatedRuns).toHaveLength(1);
    expect(trace.relatedLogs).toHaveLength(1);
    expect(trace.coherent).toBe(true);
    expect(trace.violations).toHaveLength(0);
  });

  it("invoice company_id matches the company record", async () => {
    setupMock();
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.invoice?.company_id).toBe(trace.company?.id);
  });

  it("invoice agent_id matches the agent record and the agent belongs to the same company", async () => {
    setupMock();
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.invoice?.agent_id).toBe(trace.agent?.id);
    expect(trace.agent?.company_id).toBe(trace.invoice?.company_id);
  });

  it("related runs and logs share the invoice's company_id", async () => {
    setupMock();
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    for (const run of trace.relatedRuns) {
      expect(run.company_id).toBe(COMPANY_ID);
      expect(run.agent_id).toBe(AGENT_ID);
    }

    const runIds = trace.relatedRuns.map((r) => r.id);
    for (const log of trace.relatedLogs) {
      expect(log.company_id).toBe(COMPANY_ID);
      expect(runIds).toContain(log.run_id);
    }
  });

  it("detects company mismatch between agent and invoice", async () => {
    setupMock({ agentCompanyMismatch: true });
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.coherent).toBe(false);
    expect(trace.violations.length).toBeGreaterThan(0);
    expect(trace.violations[0]).toContain("WRONG-COMPANY");
  });

  it("returns incoherent trace when invoice is not found", async () => {
    setupMock({ invoice: null });
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment("nonexistent-invoice");

    expect(trace.invoice).toBeNull();
    expect(trace.coherent).toBe(false);
    expect(trace.violations[0]).toContain("not found");
  });

  it("reports missing company gracefully", async () => {
    setupMock({ company: null });
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.company).toBeNull();
    expect(trace.coherent).toBe(false);
    expect(trace.violations[0]).toContain("Company");
  });

  it("reports missing agent gracefully", async () => {
    setupMock({ agent: null });
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.agent).toBeNull();
    expect(trace.coherent).toBe(false);
    expect(trace.violations[0]).toContain("Agent");
  });

  it("handles invoice with no agent_id (company-level invoice)", async () => {
    setupMock({
      invoice: { ...PAID_INVOICE, agent_id: null },
    });
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.invoice?.agent_id).toBeNull();
    expect(trace.agent).toBeNull();
    expect(trace.relatedRuns).toHaveLength(0);
    expect(trace.relatedLogs).toHaveLength(0);
    // No violations — agent_id is optional for company-level invoices
    expect(trace.coherent).toBe(true);
  });

  it("payment proof includes tx_hash and buyer_wallet for paid invoices", async () => {
    setupMock();
    const { tracePayment } = await import("@/lib/crossflows/payment-trace");

    const trace = await tracePayment(INVOICE_ID);

    expect(trace.invoice?.paid).toBe(true);
    expect(trace.invoice?.tx_hash).toBe("0xTX_PROOF");
    expect(trace.invoice?.buyer_wallet).toBe("0xBUYER");
    expect(trace.invoice?.paid_at).toBeDefined();
  });
});
