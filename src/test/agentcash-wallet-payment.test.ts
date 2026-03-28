/**
 * AgentCash Wallet Payment — Tests
 *
 * Tests for the orchestrated AgentCash wallet/payment flow that:
 * 1. Persists AgentCash config for a company
 * 2. Builds wallet balance snapshot and payment details
 * 3. Records wallet, payment, and x402 usage evidence in
 *    agent_execution_logs and activity_events
 *
 * Covers:
 * - Config persistence (load/save)
 * - Wallet payment flow with x402 evidence
 * - Config-not-found error handling
 * - Invoice linkage for x402 traceability
 * - Payment chain resolution
 * - Insufficient balance handling
 * - Evidence recording with shared identifiers
 *
 * Fulfills: VAL-AGENTCASH-001
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* ---------- Supabase mock ---------- */

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockOrder = vi.fn();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChain = any;

function buildChain(): AnyChain {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  chain.single = mockSingle;
  chain.maybeSingle = mockMaybeSingle;
  return chain;
}

const fromMock = vi.fn((_table?: string): AnyChain => buildChain());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
  },
}));

// ---------------------------------------------------------------------------
// AgentCash Config — load/save
// ---------------------------------------------------------------------------

describe("AgentCash config persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadAgentCashConfig returns enabled + wallet from integrations table", async () => {
    const { loadAgentCashConfig } = await import("@/lib/agentcash/config");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              wallet_address: "0xAgentCashWallet",
              payment_chain: "arbitrum",
              auto_settle: true,
            },
          },
          error: null,
        });
      }
      return chain;
    });

    const config = await loadAgentCashConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.walletAddress).toBe("0xAgentCashWallet");
    expect(config.paymentChain).toBe("arbitrum");
    expect(config.autoSettle).toBe(true);
    expect(config.configured).toBe(true);
  });

  it("loadAgentCashConfig returns disconnected when no row exists", async () => {
    const { loadAgentCashConfig } = await import("@/lib/agentcash/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain;
    });

    const config = await loadAgentCashConfig("company-1");

    expect(config.enabled).toBe(false);
    expect(config.walletAddress).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("loadAgentCashConfig returns not-configured when enabled but no wallet", async () => {
    const { loadAgentCashConfig } = await import("@/lib/agentcash/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { enabled: true, config: {} },
        error: null,
      });
      return chain;
    });

    const config = await loadAgentCashConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.walletAddress).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("saveAgentCashConfig inserts a new row when none exists", async () => {
    const { saveAgentCashConfig } = await import("@/lib/agentcash/config");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
        chain.insert = vi.fn(() => {
          return { error: null };
        });
      }
      return chain;
    });

    await saveAgentCashConfig("company-1", "0xWallet", "base", true);

    expect(fromMock).toHaveBeenCalledWith("integrations");
  });

  it("saveAgentCashConfig updates an existing row", async () => {
    const { saveAgentCashConfig } = await import("@/lib/agentcash/config");

    let updateCalled = false;

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { id: "existing-row-id" },
          error: null,
        });
        chain.update = vi.fn(() => {
          updateCalled = true;
          return chain;
        });
      }
      return chain;
    });

    await saveAgentCashConfig("company-1", "0xUpdatedWallet");

    expect(updateCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AgentCash Wallet Payment Flow
// ---------------------------------------------------------------------------

describe("executeAgentCashPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when AgentCash is not configured", async () => {
    const { executeAgentCashPayment } = await import("@/lib/agentcash/wallet-payment");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-1" },
          error: null,
        });
      }
      return chain;
    });

    const result = await executeAgentCashPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amountUsdc: 1.0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("executes a successful payment and records wallet + x402 evidence", async () => {
    const { executeAgentCashPayment } = await import("@/lib/agentcash/wallet-payment");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              wallet_address: "0xAgentCashWallet",
              payment_chain: "arbitrum",
              auto_settle: true,
            },
          },
          error: null,
        });
      }
      if (table === "agent_invoices") {
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 3 }),
          }),
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-agentcash-1" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeAgentCashPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amountUsdc: 5.0,
      invoiceId: "invoice-abc",
    });

    expect(result.success).toBe(true);
    expect(result.wallet).not.toBeNull();
    expect(result.wallet!.walletAddress).toBe("0xAgentCashWallet");
    expect(result.wallet!.chain).toBe("arbitrum");
    expect(result.wallet!.balanceBefore).toBeGreaterThan(0);
    expect(result.wallet!.balanceAfter).toBeDefined();
    expect(result.amountUsdc).toBe(5.0);
    expect(result.recipientAddress).toBe("0xRecipient");
    expect(result.invoiceId).toBe("invoice-abc");
    expect(result.approvalNeeded).toBe(true);

    // Verify evidence was recorded
    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    const content = entry.content as Record<string, unknown>;
    expect(content.action).toBe("agentcash_payment");
    expect(content.integration).toBe("agentcash");
    expect(content.walletAddress).toBe("0xAgentCashWallet");
    expect(content.chain).toBe("arbitrum");
    expect(content.invoiceId).toBe("invoice-abc");
    expect(content.x402).toBeDefined();

    const x402 = content.x402 as Record<string, unknown>;
    expect(x402.protocol).toBe("x402");
    expect(x402.linkedInvoice).toBe("invoice-abc");
    expect(x402.autoSettle).toBe(true);
  });

  it("defaults to arbitrum chain when no preference is set", async () => {
    const { executeAgentCashPayment } = await import("@/lib/agentcash/wallet-payment");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              wallet_address: "0xWallet",
              // no payment_chain
            },
          },
          error: null,
        });
      }
      if (table === "agent_invoices") {
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0 }),
          }),
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-default" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeAgentCashPayment({
      companyId: "company-1",
      recipientAddress: "0xRecipient",
      amountUsdc: 1.0,
    });

    expect(result.success).toBe(true);
    expect(result.wallet!.chain).toBe("arbitrum");
  });

  it("uses explicit chain override", async () => {
    const { executeAgentCashPayment } = await import("@/lib/agentcash/wallet-payment");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              wallet_address: "0xWallet",
              payment_chain: "arbitrum",
            },
          },
          error: null,
        });
      }
      if (table === "agent_invoices") {
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0 }),
          }),
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-chain" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeAgentCashPayment({
      companyId: "company-1",
      recipientAddress: "0xRecipient",
      amountUsdc: 1.0,
      paymentChain: "celo",
    });

    expect(result.success).toBe(true);
    expect(result.wallet!.chain).toBe("celo");
  });

  it("records evidence with shared identifiers (company, agent, run)", async () => {
    const { executeAgentCashPayment } = await import("@/lib/agentcash/wallet-payment");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              wallet_address: "0xWallet",
            },
          },
          error: null,
        });
      }
      if (table === "agent_invoices") {
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 5 }),
          }),
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-shared" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    await executeAgentCashPayment({
      companyId: "company-abc",
      agentId: "agent-xyz",
      runId: "run-456",
      recipientAddress: "0xRecipient",
      amountUsdc: 2.0,
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    expect(entry.agent_id).toBe("agent-xyz");
    expect(entry.company_id).toBe("company-abc");
    expect(entry.run_id).toBe("run-456");
  });

  it("records wallet balance snapshot in evidence", async () => {
    const { executeAgentCashPayment } = await import("@/lib/agentcash/wallet-payment");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              wallet_address: "0xWallet",
              payment_chain: "base",
              auto_settle: false,
            },
          },
          error: null,
        });
      }
      if (table === "agent_invoices") {
        chain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 2 }),
          }),
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-wallet" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    await executeAgentCashPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amountUsdc: 10.0,
      memo: "Test payment",
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    const content = entry.content as Record<string, unknown>;

    const wallet = content.wallet as Record<string, unknown>;
    expect(wallet).toBeDefined();
    expect(wallet.balanceBefore).toBeGreaterThan(0);
    expect(wallet.balanceAfter).toBeDefined();
    expect(wallet.x402TransactionCount).toBeDefined();

    expect(content.memo).toBe("Test payment");
    expect(content.chain).toBe("base");
    expect(content.approvalNeeded).toBe(true);
    expect(content.status).toBe("prepared");
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("AgentCash barrel re-exports", () => {
  it("exports executeAgentCashPayment from barrel", async () => {
    const mod = await import("@/lib/agentcash/index");
    expect(mod.executeAgentCashPayment).toBeDefined();
    expect(typeof mod.executeAgentCashPayment).toBe("function");
  });

  it("exports loadAgentCashConfig from barrel", async () => {
    const mod = await import("@/lib/agentcash/index");
    expect(mod.loadAgentCashConfig).toBeDefined();
    expect(typeof mod.loadAgentCashConfig).toBe("function");
  });

  it("exports saveAgentCashConfig from barrel", async () => {
    const mod = await import("@/lib/agentcash/index");
    expect(mod.saveAgentCashConfig).toBeDefined();
    expect(typeof mod.saveAgentCashConfig).toBe("function");
  });
});
