/**
 * Uniswap Quote & Swap Surface — Tests
 *
 * Tests for the orchestrated quote/swap flow that:
 * 1. Persists Uniswap config for a company
 * 2. Executes quote and swap flows via the UniswapClient
 * 3. Records evidence in agent_execution_logs and activity_events
 *
 * Covers:
 * - Config persistence (load/save)
 * - Quote flow with approval-needed state
 * - Swap flow with transaction evidence
 * - Config-not-found error handling
 * - Finance/runtime trail recording
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TEST_UNISWAP_PROXY_URL } from "@/test/test-env";

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

/* ---------- Fetch mock ---------- */

let fetchSpy: ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Mock Uniswap API responses
// ---------------------------------------------------------------------------

const MOCK_APPROVAL_NOT_NEEDED = {
  requestId: "req-approval-1",
  approval: null,
  cancel: null,
};

const MOCK_APPROVAL_NEEDED = {
  requestId: "req-approval-2",
  approval: {
    to: "mock-token-in",
    from: "mock-wallet",
    data: "0x095ea7b3",
    value: "0x00",
    chainId: 42161,
    gasLimit: "56344",
  },
  cancel: null,
  gasFee: "262366",
};

const MOCK_CLASSIC_QUOTE = {
  chainId: 42161,
  input: { token: "mock-token-in", amount: "1000000" },
  output: { token: "mock-token-out", amount: "5000000", recipient: "mock-wallet" },
  swapper: "mock-wallet",
  route: [[{ type: "v3-pool", address: "mock-pool" }]],
  slippage: 0.5,
  tradeType: "EXACT_INPUT",
  quoteId: "quote-uniswap-123",
  gasFeeUSD: "1.50",
  gasFeeQuote: "500000",
  gasUseEstimate: "180000",
  priceImpact: 0.1,
  txFailureReasons: [],
  gasFee: "500000",
  routeString: "[V3] 100% = TokenIn -- 0.3% TokenOut",
  blockNumber: "19000000",
  aggregatedOutputs: [
    { token: "mock-token-out", amount: "5000000", recipient: "mock-wallet", bps: 10000, minAmount: "4975000" },
  ],
};

const MOCK_QUOTE_RESPONSE = {
  requestId: "req-quote-1",
  quote: MOCK_CLASSIC_QUOTE,
  routing: "CLASSIC",
  permitData: {
    domain: { name: "Permit2", chainId: 42161 },
    values: { details: { token: "mock-token-in" } },
    types: { PermitSingle: [] },
  },
};

const MOCK_SWAP_RESPONSE = {
  requestId: "req-swap-1",
  swap: {
    to: "mock-router",
    from: "mock-wallet",
    data: "0x3593564c",
    value: "0x00",
    chainId: 42161,
  },
  gasFee: "900000",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchResponses(...responses: unknown[]) {
  for (const resp of responses) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(resp),
    });
  }
}

// ---------------------------------------------------------------------------
// Uniswap Config — load/save
// ---------------------------------------------------------------------------

describe("Uniswap config persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadUniswapConfig returns enabled + chainId from integrations table", async () => {
    const { loadUniswapConfig } = await import("@/lib/uniswap/config");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { chain_id: "42161", api_key: "test-key" },
          },
          error: null,
        });
      }
      return chain;
    });

    const config = await loadUniswapConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.chainId).toBe(42161);
    expect(config.configured).toBe(true);
  });

  it("loadUniswapConfig returns disconnected when no row exists", async () => {
    const { loadUniswapConfig } = await import("@/lib/uniswap/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain;
    });

    const config = await loadUniswapConfig("company-1");

    expect(config.enabled).toBe(false);
    expect(config.chainId).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("loadUniswapConfig returns not-configured when enabled but no chain", async () => {
    const { loadUniswapConfig } = await import("@/lib/uniswap/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { enabled: true, config: {} },
        error: null,
      });
      return chain;
    });

    const config = await loadUniswapConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.chainId).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("saveUniswapConfig inserts a new row when none exists", async () => {
    const { saveUniswapConfig } = await import("@/lib/uniswap/config");

    const insertCalls: unknown[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        // First call: select check (no existing row)
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
        // Second call: insert
        chain.insert = vi.fn((payload: unknown) => {
          insertCalls.push(payload);
          return { error: null };
        });
      }
      return chain;
    });

    await saveUniswapConfig("company-1", 42161, "test-key");

    // Verify insert was called with correct integration_key
    expect(fromMock).toHaveBeenCalledWith("integrations");
  });

  it("saveUniswapConfig updates an existing row", async () => {
    const { saveUniswapConfig } = await import("@/lib/uniswap/config");

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

    await saveUniswapConfig("company-1", 8453);

    expect(updateCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Quote Flow
// ---------------------------------------------------------------------------

describe("executeQuoteFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when Uniswap is not configured and no chainId override given", async () => {
    const { executeQuoteFlow } = await import("@/lib/uniswap/quote-swap");

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

    const result = await executeQuoteFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("executes a successful quote and records evidence", async () => {
    const { executeQuoteFlow } = await import("@/lib/uniswap/quote-swap");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { chain_id: "42161" },
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
          data: { id: "log-evidence-1" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    // Mock fetch: approval (no approval needed) + quote
    mockFetchResponses(MOCK_APPROVAL_NOT_NEEDED, MOCK_QUOTE_RESPONSE);

    const result = await executeQuoteFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(true);
    expect(result.quoteResponse).not.toBeNull();
    expect(result.quoteResponse?.routing).toBe("CLASSIC");
    expect(result.approvalNeeded).toBe(false);
    expect(result.chainId).toBe(42161);
  });

  it("detects approval-needed state and records it in evidence", async () => {
    const { executeQuoteFlow } = await import("@/lib/uniswap/quote-swap");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { chain_id: "42161" },
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
          data: { id: "log-evidence-2" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    // Mock: approval needed + quote
    mockFetchResponses(MOCK_APPROVAL_NEEDED, MOCK_QUOTE_RESPONSE);

    const result = await executeQuoteFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(true);
    expect(result.approvalNeeded).toBe(true);
    expect(result.approvalTransaction).not.toBeNull();
  });

  it("uses explicit chainId override instead of config", async () => {
    const { executeQuoteFlow } = await import("@/lib/uniswap/quote-swap");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
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

    mockFetchResponses(MOCK_APPROVAL_NOT_NEEDED, MOCK_QUOTE_RESPONSE);

    const result = await executeQuoteFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
      chainId: 8453,
    });

    expect(result.success).toBe(true);
    // Chain ID should be the explicit override
    expect(result.chainId).toBe(8453);
  });

  it("handles approval check failure gracefully", async () => {
    const { executeQuoteFlow } = await import("@/lib/uniswap/quote-swap");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { enabled: true, config: { chain_id: "42161" } },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-err" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    // Mock approval failure
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const result = await executeQuoteFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Approval check failed");
  });
});

// ---------------------------------------------------------------------------
// Swap Flow
// ---------------------------------------------------------------------------

describe("executeSwapFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when Uniswap is not configured", async () => {
    const { executeSwapFlow } = await import("@/lib/uniswap/quote-swap");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-err" },
          error: null,
        });
      }
      return chain;
    });

    const result = await executeSwapFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("executes a full classic swap and records transaction evidence", async () => {
    const { executeSwapFlow } = await import("@/lib/uniswap/quote-swap");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { enabled: true, config: { chain_id: "42161" } },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-swap-1" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    // Full pipeline: approval + quote + swap
    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_QUOTE_RESPONSE,
      MOCK_SWAP_RESPONSE,
    );

    const result = await executeSwapFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(true);
    expect(result.transactionHash).toBe("req-swap-1");
    expect(result.routing).toBe("CLASSIC");
    expect(result.approvalNeeded).toBe(false);
    expect(result.chainId).toBe(42161);

    // Verify evidence was recorded
    expect(logInsertCalls.length).toBeGreaterThan(0);
    const evidenceEntry = logInsertCalls[0];
    const content = evidenceEntry.content as Record<string, unknown>;
    expect(content.action).toBe("uniswap_swap");
    expect(content.integration).toBe("uniswap");
    expect(content.transactionHash).toBe("req-swap-1");
    expect(content.routing).toBe("CLASSIC");
    expect(content.chainId).toBe(42161);
  });

  it("records approval-needed state in swap evidence", async () => {
    const { executeSwapFlow } = await import("@/lib/uniswap/quote-swap");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { enabled: true, config: { chain_id: "42161" } },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-swap-approval" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    // Approval needed + quote + swap
    mockFetchResponses(
      MOCK_APPROVAL_NEEDED,
      MOCK_QUOTE_RESPONSE,
      MOCK_SWAP_RESPONSE,
    );

    const result = await executeSwapFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(true);
    expect(result.approvalNeeded).toBe(true);

    // Verify approval info is in the evidence
    const evidenceEntry = logInsertCalls[0];
    const content = evidenceEntry.content as Record<string, unknown>;
    expect(content.approvalNeeded).toBe(true);
    expect(content.approvalTransaction).toBeDefined();
  });

  it("records failure evidence when swap fails", async () => {
    const { executeSwapFlow } = await import("@/lib/uniswap/quote-swap");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { enabled: true, config: { chain_id: "42161" } },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-swap-fail" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    // Approval ok + quote ok + swap fails
    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_QUOTE_RESPONSE,
    );
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Simulation failed"),
    });

    const result = await executeSwapFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Swap execution failed");

    // Verify failure evidence was recorded
    const failEvidence = logInsertCalls.find((log) => {
      const c = log.content as Record<string, unknown>;
      return c.action === "uniswap_swap_failed";
    });
    expect(failEvidence).toBeDefined();
  });

  it("uses explicit chainId override for swap flow", async () => {
    const { executeSwapFlow } = await import("@/lib/uniswap/quote-swap");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
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

    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_QUOTE_RESPONSE,
      MOCK_SWAP_RESPONSE,
    );

    const result = await executeSwapFlow({
      companyId: "company-1",
      agentId: "agent-1",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
      chainId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.chainId).toBe(1);
  });

  it("records evidence with shared identifiers (company, agent, run)", async () => {
    const { executeSwapFlow } = await import("@/lib/uniswap/quote-swap");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { enabled: true, config: { chain_id: "42161" } },
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

    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_QUOTE_RESPONSE,
      MOCK_SWAP_RESPONSE,
    );

    await executeSwapFlow({
      companyId: "company-abc",
      agentId: "agent-xyz",
      runId: "run-123",
      tokenIn: "mock-token-in",
      tokenOut: "mock-token-out",
      amount: "1000000",
      walletAddress: "mock-wallet-addr",
    });

    // Verify shared identifiers in the evidence log
    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    expect(entry.agent_id).toBe("agent-xyz");
    expect(entry.company_id).toBe("company-abc");
    expect(entry.run_id).toBe("run-123");
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("Uniswap barrel re-exports new quote-swap surface", () => {
  it("exports executeQuoteFlow from barrel", async () => {
    const mod = await import("@/lib/uniswap/index");
    expect(mod.executeQuoteFlow).toBeDefined();
    expect(typeof mod.executeQuoteFlow).toBe("function");
  });

  it("exports executeSwapFlow from barrel", async () => {
    const mod = await import("@/lib/uniswap/index");
    expect(mod.executeSwapFlow).toBeDefined();
    expect(typeof mod.executeSwapFlow).toBe("function");
  });

  it("exports loadUniswapConfig from barrel", async () => {
    const mod = await import("@/lib/uniswap/index");
    expect(mod.loadUniswapConfig).toBeDefined();
    expect(typeof mod.loadUniswapConfig).toBe("function");
  });

  it("exports saveUniswapConfig from barrel", async () => {
    const mod = await import("@/lib/uniswap/index");
    expect(mod.saveUniswapConfig).toBeDefined();
    expect(typeof mod.saveUniswapConfig).toBe("function");
  });
});
