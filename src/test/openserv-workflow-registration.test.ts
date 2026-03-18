/**
 * OpenServ Workflow Registration — Tests
 *
 * Tests for the orchestrated OpenServ workflow/x402 service registration
 * flow that:
 * 1. Persists OpenServ config for a company
 * 2. Resolves agent ERC-8004 identity for registration
 * 3. Records registration evidence with agent identity linkage in
 *    agent_execution_logs and activity_events
 *
 * Covers:
 * - Config persistence (load/save)
 * - Workflow registration flow with identity linkage
 * - Config-not-found error handling
 * - Agent identity resolution
 * - x402 pricing evidence
 * - Evidence recording with shared identifiers
 *
 * Fulfills: VAL-OPENSERV-001
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
// OpenServ Config — load/save
// ---------------------------------------------------------------------------

describe("OpenServ config persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadOpenServConfig returns enabled + service name from integrations table", async () => {
    const { loadOpenServConfig } = await import("@/lib/openserv/config");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              service_name: "agent-task-service",
              service_endpoint: "https://api.example.com/tasks",
              workflow_type: "task",
            },
          },
          error: null,
        });
      }
      return chain;
    });

    const config = await loadOpenServConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.serviceName).toBe("agent-task-service");
    expect(config.serviceEndpoint).toBe("https://api.example.com/tasks");
    expect(config.workflowType).toBe("task");
    expect(config.configured).toBe(true);
  });

  it("loadOpenServConfig returns disconnected when no row exists", async () => {
    const { loadOpenServConfig } = await import("@/lib/openserv/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain;
    });

    const config = await loadOpenServConfig("company-1");

    expect(config.enabled).toBe(false);
    expect(config.serviceName).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("loadOpenServConfig returns not-configured when enabled but no service name", async () => {
    const { loadOpenServConfig } = await import("@/lib/openserv/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { enabled: true, config: {} },
        error: null,
      });
      return chain;
    });

    const config = await loadOpenServConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.serviceName).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("saveOpenServConfig inserts a new row when none exists", async () => {
    const { saveOpenServConfig } = await import("@/lib/openserv/config");

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

    await saveOpenServConfig("company-1", "my-service", "https://api.example.com", "orchestration");

    expect(fromMock).toHaveBeenCalledWith("integrations");
  });

  it("saveOpenServConfig updates an existing row", async () => {
    const { saveOpenServConfig } = await import("@/lib/openserv/config");

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

    await saveOpenServConfig("company-1", "updated-service");

    expect(updateCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// OpenServ Workflow Registration Flow
// ---------------------------------------------------------------------------

describe("executeOpenServRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when no service name is configured or provided", async () => {
    const { executeOpenServRegistration } = await import("@/lib/openserv/workflow-registration");

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

    const result = await executeOpenServRegistration({
      companyId: "company-1",
      agentId: "agent-1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("no service name");
  });

  it("registers a workflow with agent identity and records evidence", async () => {
    const { executeOpenServRegistration } = await import("@/lib/openserv/workflow-registration");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: {
              service_name: "agent-task-service",
              service_endpoint: "https://api.example.com/tasks",
              workflow_type: "task",
            },
          },
          error: null,
        });
      }
      if (table === "agent_identities") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            operator_wallet: "0xOperatorWallet",
            manifest: {
              erc8004_identity: "erc8004-id-123",
            },
          },
          error: null,
        });
      }
      if (table === "agents") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { name: "Test Agent" },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-openserv-1" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeOpenServRegistration({
      companyId: "company-1",
      agentId: "agent-1",
    });

    expect(result.success).toBe(true);
    expect(result.registration).not.toBeNull();
    expect(result.registration!.serviceName).toBe("agent-task-service");
    expect(result.registration!.workflowType).toBe("task");
    expect(result.registration!.registrationId).toContain("openserv-");
    expect(result.registration!.agentIdentity.agentId).toBe("agent-1");
    expect(result.registration!.agentIdentity.operatorWallet).toBe("0xOperatorWallet");
    expect(result.registration!.agentIdentity.erc8004Identity).toBe("erc8004-id-123");
    expect(result.registration!.agentIdentity.name).toBe("Test Agent");
    expect(result.registration!.pricingUsdc).toBeGreaterThan(0);
    expect(result.registration!.registeredAt).toBeDefined();
  });

  it("uses explicit overrides for service name and workflow type", async () => {
    const { executeOpenServRegistration } = await import("@/lib/openserv/workflow-registration");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
      }
      if (table === "agent_identities") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            operator_wallet: "0xWallet",
            manifest: { erc8004_identity: "erc8004-x" },
          },
          error: null,
        });
      }
      if (table === "agents") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { name: "Override Agent" },
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

    const result = await executeOpenServRegistration({
      companyId: "company-1",
      agentId: "agent-1",
      serviceName: "custom-pipeline",
      workflowType: "data_pipeline",
      pricingUsdc: 0.05,
    });

    expect(result.success).toBe(true);
    expect(result.registration!.serviceName).toBe("custom-pipeline");
    expect(result.registration!.workflowType).toBe("data_pipeline");
    expect(result.registration!.pricingUsdc).toBe(0.05);
  });

  it("records evidence with x402 pricing and agent identity", async () => {
    const { executeOpenServRegistration } = await import("@/lib/openserv/workflow-registration");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { service_name: "test-service" },
          },
          error: null,
        });
      }
      if (table === "agent_identities") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            operator_wallet: "0xOpWallet",
            manifest: { erc8004_identity: "erc-id-456" },
          },
          error: null,
        });
      }
      if (table === "agents") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { name: "Evidence Agent" },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-evidence" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    await executeOpenServRegistration({
      companyId: "company-abc",
      agentId: "agent-xyz",
      runId: "run-123",
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    expect(entry.agent_id).toBe("agent-xyz");
    expect(entry.company_id).toBe("company-abc");
    expect(entry.run_id).toBe("run-123");

    const content = entry.content as Record<string, unknown>;
    expect(content.action).toBe("openserv_workflow_registration");
    expect(content.integration).toBe("openserv");
    expect(content.registrationId).toBeDefined();
    expect(content.agentIdentity).toBeDefined();
    expect(content.x402).toBeDefined();

    const x402 = content.x402 as Record<string, unknown>;
    expect(x402.protocol).toBe("x402");
    expect(x402.paymentRequired).toBe(true);
    expect(x402.amountUsdc).toBeGreaterThan(0);
  });

  it("registers without identity when agent_identities has no row", async () => {
    const { executeOpenServRegistration } = await import("@/lib/openserv/workflow-registration");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { service_name: "test-service" },
          },
          error: null,
        });
      }
      if (table === "agent_identities") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: null,
          error: null,
        });
      }
      if (table === "agents") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: { name: "NoIdentity Agent" },
          error: null,
        });
      }
      if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-no-id" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    const result = await executeOpenServRegistration({
      companyId: "company-1",
      agentId: "agent-1",
    });

    expect(result.success).toBe(true);
    expect(result.registration!.agentIdentity.operatorWallet).toBeNull();
    expect(result.registration!.agentIdentity.erc8004Identity).toBeNull();
    expect(result.registration!.agentIdentity.name).toBe("NoIdentity Agent");
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("OpenServ barrel re-exports", () => {
  it("exports executeOpenServRegistration from barrel", async () => {
    const mod = await import("@/lib/openserv/index");
    expect(mod.executeOpenServRegistration).toBeDefined();
    expect(typeof mod.executeOpenServRegistration).toBe("function");
  });

  it("exports loadOpenServConfig from barrel", async () => {
    const mod = await import("@/lib/openserv/index");
    expect(mod.loadOpenServConfig).toBeDefined();
    expect(typeof mod.loadOpenServConfig).toBe("function");
  });

  it("exports saveOpenServConfig from barrel", async () => {
    const mod = await import("@/lib/openserv/index");
    expect(mod.saveOpenServConfig).toBeDefined();
    expect(typeof mod.saveOpenServConfig).toBe("function");
  });
});
