/**
 * Celo Payment Flow — Tests
 *
 * Tests for the orchestrated Celo payment/treasury flow that:
 * 1. Persists Celo config for a company
 * 2. Prepares a Celo stablecoin payment with chain configuration
 * 3. Records chain, payment, and finance evidence in
 *    agent_execution_logs and activity_events
 *
 * Covers:
 * - Config persistence (load/save)
 * - Payment flow with finance trace
 * - Config-not-found error handling
 * - Stablecoin resolution (cUSD / cEUR)
 * - Missing sender address error handling
 * - Finance/runtime trail recording with shared identifiers
 *
 * Fulfills: VAL-CELO-001
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
// Celo Config — load/save
// ---------------------------------------------------------------------------

describe("Celo config persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadCeloConfig returns enabled + network from integrations table", async () => {
    const { loadCeloConfig } = await import("@/lib/celo/integration-config");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
              preferred_stablecoin: "cUSD",
            },
          },
          error: null,
        });
      }
      return chain;
    });

    const config = await loadCeloConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.network).toBe("mainnet");
    expect(config.treasuryAddress).toBe("0xTreasury");
    expect(config.preferredStablecoin).toBe("cUSD");
    expect(config.configured).toBe(true);
  });

  it("loadCeloConfig returns disconnected when no row exists", async () => {
    const { loadCeloConfig } = await import("@/lib/celo/integration-config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain;
    });

    const config = await loadCeloConfig("company-1");

    expect(config.enabled).toBe(false);
    expect(config.network).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("loadCeloConfig returns not-configured when enabled but no network", async () => {
    const { loadCeloConfig } = await import("@/lib/celo/integration-config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { enabled: true, config: {} },
        error: null,
      });
      return chain;
    });

    const config = await loadCeloConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.network).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("saveCeloConfig inserts a new row when none exists", async () => {
    const { saveCeloConfig } = await import("@/lib/celo/integration-config");

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

    await saveCeloConfig("company-1", "mainnet", "0xTreasury", "cUSD");

    expect(fromMock).toHaveBeenCalledWith("integrations");
  });

  it("saveCeloConfig updates an existing row", async () => {
    const { saveCeloConfig } = await import("@/lib/celo/integration-config");

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

    await saveCeloConfig("company-1", "alfajores");

    expect(updateCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Celo Payment Flow
// ---------------------------------------------------------------------------

describe("executeCeloPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when Celo is not configured", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

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

    const result = await executeCeloPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amount: 1.0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("returns error when no sender/treasury address is available", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { network: "mainnet" },
          },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-err" },
          error: null,
        });
      }
      return chain;
    });

    const result = await executeCeloPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amount: 1.0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no sender/treasury address");
  });

  it("executes a successful cUSD payment and records finance evidence", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
              preferred_stablecoin: "cUSD",
            },
          },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-celo-1" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeCeloPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amount: 1.5,
    });

    expect(result.success).toBe(true);
    expect(result.network).toBe("mainnet");
    expect(result.stablecoin).toBe("cUSD");
    expect(result.chainId).toBe(42220);
    expect(result.senderAddress).toBe("0xTreasury");
    expect(result.recipientAddress).toBe("0xRecipient");
    expect(result.amountHuman).toBe(1.5);
    expect(result.amountSmallestUnit).toBeDefined();
    expect(result.approvalNeeded).toBe(true);

    // Verify evidence was recorded
    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    const content = entry.content as Record<string, unknown>;
    expect(content.action).toBe("celo_payment");
    expect(content.integration).toBe("celo");
    expect(content.network).toBe("mainnet");
    expect(content.chainId).toBe(42220);
    expect(content.stablecoin).toBe("cUSD");
    expect(content.amountHuman).toBe(1.5);
  });

  it("uses cEUR when specified as stablecoin override", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
            },
          },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-ceur" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeCeloPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amount: 2.0,
      stablecoin: "cEUR",
    });

    expect(result.success).toBe(true);
    expect(result.stablecoin).toBe("cEUR");
    expect(result.tokenAddress).toBeDefined();
    // cEUR address should be different from cUSD
    expect(result.tokenAddress?.toLowerCase()).toContain("d8763cba");
  });

  it("uses explicit sender address instead of config treasury", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
            },
          },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-x" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeCeloPayment({
      companyId: "company-1",
      recipientAddress: "0xRecipient",
      amount: 0.5,
      senderAddress: "0xCustomSender",
    });

    expect(result.success).toBe(true);
    expect(result.senderAddress).toBe("0xCustomSender");
  });

  it("records evidence with shared identifiers (company, agent, run)", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "alfajores",
              treasury_address: "0xTestTreasury",
            },
          },
          error: null,
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

    await executeCeloPayment({
      companyId: "company-abc",
      agentId: "agent-xyz",
      runId: "run-456",
      recipientAddress: "0xRecipient",
      amount: 1.0,
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    expect(entry.agent_id).toBe("agent-xyz");
    expect(entry.company_id).toBe("company-abc");
    expect(entry.run_id).toBe("run-456");
  });

  it("includes chain config details in evidence for validation", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
              preferred_stablecoin: "cUSD",
            },
          },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-config" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    await executeCeloPayment({
      companyId: "company-1",
      agentId: "agent-1",
      recipientAddress: "0xRecipient",
      amount: 1.0,
      memo: "Test payment",
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    const content = entry.content as Record<string, unknown>;

    // Chain config details for validation
    const chainConfig = content.chainConfig as Record<string, unknown>;
    expect(chainConfig).toBeDefined();
    expect(chainConfig.name).toBe("Celo");
    expect(chainConfig.rpcUrl).toBe("https://forno.celo.org");
    expect(chainConfig.explorerUrl).toBe("https://celoscan.io");
    expect(chainConfig.nativeCurrency).toBe("CELO");

    // Memo included
    expect(content.memo).toBe("Test payment");
  });

  it("defaults to cUSD when no stablecoin preference is set", async () => {
    const { executeCeloPayment } = await import("@/lib/celo/payment-flow");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
              // no preferred_stablecoin
            },
          },
          error: null,
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

    const result = await executeCeloPayment({
      companyId: "company-1",
      recipientAddress: "0xRecipient",
      amount: 1.0,
    });

    expect(result.success).toBe(true);
    expect(result.stablecoin).toBe("cUSD");
    // cUSD address check
    expect(result.tokenAddress?.toLowerCase()).toContain("765de816");
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("Celo barrel re-exports payment flow", () => {
  it("exports executeCeloPayment from barrel", async () => {
    const mod = await import("@/lib/celo/index");
    expect(mod.executeCeloPayment).toBeDefined();
    expect(typeof mod.executeCeloPayment).toBe("function");
  });

  it("exports loadCeloConfig from barrel", async () => {
    const mod = await import("@/lib/celo/index");
    expect(mod.loadCeloConfig).toBeDefined();
    expect(typeof mod.loadCeloConfig).toBe("function");
  });

  it("exports saveCeloConfig from barrel", async () => {
    const mod = await import("@/lib/celo/index");
    expect(mod.saveCeloConfig).toBeDefined();
    expect(typeof mod.saveCeloConfig).toBe("function");
  });

  it("exports chain constants from barrel", async () => {
    const mod = await import("@/lib/celo/index");
    expect(mod.CELO_CHAIN_ID).toBe(42220);
    expect(mod.CELO_CHAIN_CONFIG).toBeDefined();
    expect(mod.CUSD_TOKEN_ADDRESS).toBeDefined();
    expect(mod.CEUR_TOKEN_ADDRESS).toBeDefined();
  });
});
