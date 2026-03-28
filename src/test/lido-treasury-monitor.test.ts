/**
 * Lido Treasury Monitor — Tests
 *
 * Tests for the orchestrated Lido treasury monitoring flow that:
 * 1. Persists Lido config for a company
 * 2. Builds a dry-run staking position snapshot
 * 3. Records position, reward, and monitoring evidence in
 *    agent_execution_logs and activity_events
 *
 * Covers:
 * - Config persistence (load/save)
 * - Treasury monitoring flow with position evidence
 * - Config-not-found error handling
 * - Missing treasury address error handling
 * - Monitoring mode resolution
 * - Evidence recording with shared identifiers
 *
 * Fulfills: VAL-LIDO-001
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
// Lido Config — load/save
// ---------------------------------------------------------------------------

describe("Lido config persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadLidoConfig returns enabled + network from integrations table", async () => {
    const { loadLidoConfig } = await import("@/lib/lido/integration-config");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
              monitoring_mode: "position",
            },
          },
          error: null,
        });
      }
      return chain;
    });

    const config = await loadLidoConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.network).toBe("mainnet");
    expect(config.treasuryAddress).toBe("0xTreasury");
    expect(config.monitoringMode).toBe("position");
    expect(config.configured).toBe(true);
  });

  it("loadLidoConfig returns disconnected when no row exists", async () => {
    const { loadLidoConfig } = await import("@/lib/lido/integration-config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain;
    });

    const config = await loadLidoConfig("company-1");

    expect(config.enabled).toBe(false);
    expect(config.network).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("loadLidoConfig returns not-configured when enabled but no network", async () => {
    const { loadLidoConfig } = await import("@/lib/lido/integration-config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { enabled: true, config: {} },
        error: null,
      });
      return chain;
    });

    const config = await loadLidoConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.network).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("saveLidoConfig inserts a new row when none exists", async () => {
    const { saveLidoConfig } = await import("@/lib/lido/integration-config");

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

    await saveLidoConfig("company-1", "mainnet", "0xTreasury", "position");

    expect(fromMock).toHaveBeenCalledWith("integrations");
  });

  it("saveLidoConfig updates an existing row", async () => {
    const { saveLidoConfig } = await import("@/lib/lido/integration-config");

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

    await saveLidoConfig("company-1", "goerli");

    expect(updateCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lido Treasury Monitor Flow
// ---------------------------------------------------------------------------

describe("executeLidoMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when Lido is not configured", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

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

    const result = await executeLidoMonitor({
      companyId: "company-1",
      agentId: "agent-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("returns error when no treasury address is available", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

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

    const result = await executeLidoMonitor({
      companyId: "company-1",
      agentId: "agent-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no treasury address");
  });

  it("executes a successful position monitor and records evidence", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury123",
              monitoring_mode: "position",
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
          data: { id: "log-lido-1" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeLidoMonitor({
      companyId: "company-1",
      agentId: "agent-1",
    });

    expect(result.success).toBe(true);
    expect(result.network).toBe("mainnet");
    expect(result.mode).toBe("position");
    expect(result.treasuryAddress).toBe("0xTreasury123");
    expect(result.position).not.toBeNull();
    expect(result.position!.stethBalance).toBeGreaterThan(0);
    expect(result.position!.wstethBalance).toBeGreaterThan(0);
    expect(result.position!.currentApr).toBeGreaterThan(0);
    expect(result.position!.estimatedDailyRewardEth).toBeGreaterThan(0);
    expect(result.position!.totalPositionEth).toBeGreaterThan(0);
    expect(result.position!.stethBalanceWei).toBeDefined();
    expect(result.position!.wstethBalanceWei).toBeDefined();

    // Verify evidence was recorded
    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    const content = entry.content as Record<string, unknown>;
    expect(content.action).toBe("lido_treasury_monitor");
    expect(content.integration).toBe("lido");
    expect(content.network).toBe("mainnet");
    expect(content.mode).toBe("position");
    expect(content.treasuryAddress).toBe("0xTreasury123");
    expect(content.position).toBeDefined();
    expect(content.status).toBe("dry_run");
  });

  it("uses explicit treasury address override", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xConfigTreasury",
            },
          },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-override" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeLidoMonitor({
      companyId: "company-1",
      treasuryAddress: "0xOverrideTreasury",
    });

    expect(result.success).toBe(true);
    expect(result.treasuryAddress).toBe("0xOverrideTreasury");
  });

  it("uses mode override instead of config", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              network: "mainnet",
              treasury_address: "0xTreasury",
              monitoring_mode: "position",
            },
          },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-mode" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeLidoMonitor({
      companyId: "company-1",
      mode: "rewards",
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe("rewards");
  });

  it("records evidence with shared identifiers (company, agent, run)", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

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

    await executeLidoMonitor({
      companyId: "company-abc",
      agentId: "agent-xyz",
      runId: "run-789",
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    expect(entry.agent_id).toBe("agent-xyz");
    expect(entry.company_id).toBe("company-abc");
    expect(entry.run_id).toBe("run-789");
  });

  it("includes chain config details in evidence for validation", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

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

    await executeLidoMonitor({
      companyId: "company-1",
      agentId: "agent-1",
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    const content = entry.content as Record<string, unknown>;

    const chainConfig = content.chainConfig as Record<string, unknown>;
    expect(chainConfig).toBeDefined();
    expect(chainConfig.name).toBe("Ethereum");
    expect(chainConfig.protocol).toBe("Lido");
    expect(chainConfig.rpcUrl).toBe("https://ethereum-rpc.publicnode.com");
    expect(chainConfig.explorerUrl).toBe("https://etherscan.io");
    expect(chainConfig.withdrawalQueue).toBeDefined();
  });

  it("defaults to position mode when no monitoring mode is set", async () => {
    const { executeLidoMonitor } = await import("@/lib/lido/treasury-monitor");

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
          data: { id: "log-default" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeLidoMonitor({
      companyId: "company-1",
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe("position");
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("Lido barrel re-exports", () => {
  it("exports executeLidoMonitor from barrel", async () => {
    const mod = await import("@/lib/lido/index");
    expect(mod.executeLidoMonitor).toBeDefined();
    expect(typeof mod.executeLidoMonitor).toBe("function");
  });

  it("exports loadLidoConfig from barrel", async () => {
    const mod = await import("@/lib/lido/index");
    expect(mod.loadLidoConfig).toBeDefined();
    expect(typeof mod.loadLidoConfig).toBe("function");
  });

  it("exports saveLidoConfig from barrel", async () => {
    const mod = await import("@/lib/lido/index");
    expect(mod.saveLidoConfig).toBeDefined();
    expect(typeof mod.saveLidoConfig).toBe("function");
  });

  it("exports chain constants from barrel", async () => {
    const mod = await import("@/lib/lido/index");
    expect(mod.ETH_CHAIN_ID).toBe(1);
    expect(mod.LIDO_CHAIN_CONFIG).toBeDefined();
    expect(mod.STETH_TOKEN_ADDRESS).toBeDefined();
    expect(mod.WSTETH_TOKEN_ADDRESS).toBeDefined();
    expect(mod.WITHDRAWAL_QUEUE_ADDRESS).toBeDefined();
  });
});
