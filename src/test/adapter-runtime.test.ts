import { describe, expect, it, vi, beforeEach } from "vitest";

/* ---------- Supabase mock ---------- */

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockOrder = vi.fn();

function buildChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  chain.single = mockSingle;
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => buildChain()),
  },
}));

/* ================================================================
   resolveAdapterRuntime — agent adapter resolution
   ================================================================ */

describe("resolveAdapterRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves a known adapter type into a runtime context", async () => {
    const { resolveAdapterRuntime } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );
    const { supabase } = await import("@/integrations/supabase/client");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-1",
            adapter_type: "hermes",
            adapter_config: {
              model: "anthropic/claude-opus-4.6",
              provider: "openrouter",
              enabled_toolsets: ["web", "terminal"],
              max_turns: 90,
            },
            company_id: "company-1",
            name: "CEO Agent",
            role: "ceo",
          },
          error: null,
        });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const ctx = await resolveAdapterRuntime("agent-1");

    expect(ctx.adapterType).toBe("hermes");
    expect(ctx.adapterConfig).toHaveProperty("model");
    expect(ctx.agentName).toBe("CEO Agent");
    expect(ctx.resolved).toBe(true);
  });

  it("resolves an unknown adapter type without falling back silently", async () => {
    const { resolveAdapterRuntime } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );
    const { supabase } = await import("@/integrations/supabase/client");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-2",
            adapter_type: "totally_unknown",
            adapter_config: {},
            company_id: "company-1",
            name: "Unknown Agent",
            role: "engineer",
          },
          error: null,
        });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const ctx = await resolveAdapterRuntime("agent-2");

    expect(ctx.adapterType).toBe("totally_unknown");
    expect(ctx.resolved).toBe(true);
  });

  it("throws when agent does not exist", async () => {
    const { resolveAdapterRuntime } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );
    const { supabase } = await import("@/integrations/supabase/client");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "not found" },
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(resolveAdapterRuntime("missing-agent")).rejects.toThrow(
      "Failed to resolve adapter",
    );
  });
});

/* ================================================================
   executeAdapterStep — adapter-backed step execution
   ================================================================ */

describe("executeAdapterStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("discover step returns task analysis with adapter context", async () => {
    const { executeAdapterStep } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );

    const ctx = {
      adapterType: "hermes",
      adapterConfig: {
        model: "anthropic/claude-opus-4.6",
        enabled_toolsets: ["web", "terminal"],
      },
      agentName: "CEO Agent",
      agentRole: "ceo",
      resolved: true,
      privateCognitionEnabled: false,
    };

    const result = await executeAdapterStep("discover", ctx, {
      task: "Analyze market trends",
      previousSteps: [],
    });

    expect(result).toHaveProperty("taskAnalysis");
    expect(result).toHaveProperty("adapterType", "hermes");
    expect(result).toHaveProperty("availableTools");
    expect(result).toHaveProperty("model");
  });

  it("plan step decomposes task into adapter-aware subtasks", async () => {
    const { executeAdapterStep } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );

    const ctx = {
      adapterType: "hermes",
      adapterConfig: {
        model: "anthropic/claude-opus-4.6",
        enabled_toolsets: ["web", "terminal", "file"],
      },
      agentName: "Engineer",
      agentRole: "engineer",
      resolved: true,
      privateCognitionEnabled: false,
    };

    const discoveryData = {
      taskAnalysis: "Fix the bug",
      adapterType: "hermes",
      availableTools: ["web", "terminal", "file"],
      model: "anthropic/claude-opus-4.6",
      complexity: "medium",
      estimatedSteps: 3,
    };

    const result = await executeAdapterStep("plan", ctx, {
      task: "Fix the bug",
      previousSteps: [{ step: "discover", success: true, data: discoveryData }],
    });

    expect(result).toHaveProperty("subtasks");
    const subtasks = (result as { subtasks: unknown[] }).subtasks;
    expect(subtasks.length).toBeGreaterThan(0);
    // Each subtask should have toolset info from the adapter
    for (const st of subtasks as Array<{ toolset?: string }>) {
      expect(st).toHaveProperty("toolset");
    }
  });

  it("execute step runs subtasks through adapter tool dispatch", async () => {
    const { executeAdapterStep } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );

    const ctx = {
      adapterType: "hermes",
      adapterConfig: {
        model: "anthropic/claude-opus-4.6",
        enabled_toolsets: ["web", "code"],
      },
      agentName: "Engineer",
      agentRole: "engineer",
      resolved: true,
      privateCognitionEnabled: false,
    };

    const subtasks = [
      { id: "subtask-1", description: "Research approach", status: "pending", toolset: "web" },
      { id: "subtask-2", description: "Implement fix", status: "pending", toolset: "code" },
    ];

    const result = await executeAdapterStep("execute", ctx, {
      task: "Fix the bug",
      previousSteps: [
        { step: "discover", success: true, data: {} },
        { step: "plan", success: true, data: { subtasks } },
      ],
    });

    expect(result).toHaveProperty("completedSubtasks");
    const completed = (result as { completedSubtasks: Array<{ status: string; adapterExecution?: unknown }> }).completedSubtasks;
    for (const sub of completed) {
      expect(sub.status).toBe("completed");
      // Should have adapter execution metadata
      expect(sub).toHaveProperty("adapterExecution");
    }
  });

  it("verify step validates with adapter-aware checks", async () => {
    const { executeAdapterStep } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );

    const ctx = {
      adapterType: "hermes",
      adapterConfig: {
        model: "anthropic/claude-opus-4.6",
        enabled_toolsets: ["web"],
      },
      agentName: "QA",
      agentRole: "analyst",
      resolved: true,
      privateCognitionEnabled: false,
    };

    const completed = [
      { id: "subtask-1", description: "Task A", status: "completed", toolset: "web", adapterExecution: { model: "anthropic/claude-opus-4.6", toolset: "web", completedAt: new Date().toISOString() } },
    ];

    const result = await executeAdapterStep("verify", ctx, {
      task: "Verify task",
      previousSteps: [
        { step: "discover", success: true, data: {} },
        { step: "plan", success: true, data: { subtasks: completed } },
        { step: "execute", success: true, data: { completedSubtasks: completed } },
      ],
    });

    expect(result).toHaveProperty("verified");
    expect(result).toHaveProperty("adapterValidation");
  });
});

/* ================================================================
   Autonomous loop with adapter runtime
   ================================================================ */

describe("runAutonomousLoop — adapter-backed runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildAdapterLoopMock(
    runId: string,
    agentConfig: {
      adapter_type: string;
      adapter_config: Record<string, unknown>;
    },
  ) {
    const logInsertCalls: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.insert = vi.fn(() => chain);
        chain.update = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: runId,
            agent_id: "agent-hermes",
            company_id: "company-1",
            status: "running",
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
          },
          error: null,
        });
      } else if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-hermes",
            adapter_type: agentConfig.adapter_type,
            adapter_config: agentConfig.adapter_config,
            company_id: "company-1",
            name: "Hermes CEO",
            role: "ceo",
          },
          error: null,
        });
      } else if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-x" },
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "no identity" },
        });
      } else if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      } else if (table === "issues") {
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
      } else if (table === "approvals") {
        chain.insert = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "approval-1" },
          error: null,
        });
      }

      return chain as unknown as ReturnType<typeof import("@/integrations/supabase/client").supabase.from>;
    };

    return { mockImpl, logInsertCalls };
  }

  it("uses adapter-backed runtime when useAdapterRuntime is true", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, logInsertCalls } = buildAdapterLoopMock("run-adapter-1", {
      adapter_type: "hermes",
      adapter_config: {
        model: "anthropic/claude-opus-4.6",
        enabled_toolsets: ["web", "terminal"],
      },
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-hermes", "Test adapter runtime", {
      companyId: "company-1",
      useAdapterRuntime: true,
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(5);
    expect(result.adapterType).toBe("hermes");

    // Execution logs should contain adapter context
    const logsWithAdapter = logInsertCalls.filter((log) => {
      const content = log.content as Record<string, unknown> | undefined;
      return content && (content as Record<string, unknown>).adapterType !== undefined;
    });
    expect(logsWithAdapter.length).toBeGreaterThan(0);
  });

  it("preserves shared IDs when using adapter runtime", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const logInserts: Array<Record<string, unknown>> = [];
    const activityInserts: Array<Record<string, unknown>> = [];
    const runInserts: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          runInserts.push(payload);
          return chain;
        });
        chain.update = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "run-shared-adapter",
            agent_id: "agent-hermes",
            company_id: "company-1",
            status: "running",
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
          },
          error: null,
        });
      } else if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-hermes",
            adapter_type: "hermes",
            adapter_config: { model: "anthropic/claude-opus-4.6" },
            company_id: "company-1",
            name: "CEO",
            role: "ceo",
          },
          error: null,
        });
      } else if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInserts.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-x" },
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "no identity" },
        });
      } else if (table === "activity_events") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          activityInserts.push(payload);
          return chain;
        });
      } else if (table === "issues") {
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
      }

      return chain as unknown as ReturnType<typeof import("@/integrations/supabase/client").supabase.from>;
    };

    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-hermes", "Shared ID test", {
      companyId: "company-1",
      issueId: "issue-adapter-1",
      useAdapterRuntime: true,
    });

    expect(result.runId).toBe("run-shared-adapter");
    expect(result.agentId).toBe("agent-hermes");
    expect(result.issueId).toBe("issue-adapter-1");

    // Run insert should have matching IDs
    expect(runInserts[0]).toHaveProperty("agent_id", "agent-hermes");
    expect(runInserts[0]).toHaveProperty("company_id", "company-1");
    expect(runInserts[0]).toHaveProperty("issue_id", "issue-adapter-1");

    // Activity events should still reference all shared IDs
    for (const evt of activityInserts) {
      expect(evt.company_id).toBe("company-1");
      expect(evt.agent_id).toBe("agent-hermes");
      expect(evt.issue_id).toBe("issue-adapter-1");
    }

    // Execution logs should have matching IDs
    for (const log of logInserts) {
      expect(log.company_id).toBe("company-1");
      expect(log.agent_id).toBe("agent-hermes");
      expect(log.run_id).toBe("run-shared-adapter");
    }
  });

  it("falls back to simulated steps when useAdapterRuntime is false", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl } = buildAdapterLoopMock("run-legacy-1", {
      adapter_type: "process",
      adapter_config: {},
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-hermes", "Legacy test", {
      companyId: "company-1",
      useAdapterRuntime: false,
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(5);
    // No adapter type in result when using legacy path
    expect(result.adapterType).toBeUndefined();
  });

  it("approval lifecycle still works with adapter runtime", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const approvalInserts: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.insert = vi.fn(() => chain);
        chain.update = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "run-appr-adapter",
            agent_id: "agent-hermes",
            company_id: "company-1",
            status: "running",
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
          },
          error: null,
        });
      } else if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-hermes",
            adapter_type: "hermes",
            adapter_config: { model: "anthropic/claude-opus-4.6" },
            company_id: "company-1",
            name: "CEO",
            role: "ceo",
          },
          error: null,
        });
      } else if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-x" },
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "no identity" },
        });
      } else if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      } else if (table === "issues") {
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
      } else if (table === "approvals") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          approvalInserts.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "approval-adapter-1" },
          error: null,
        });
      }

      return chain as unknown as ReturnType<typeof import("@/integrations/supabase/client").supabase.from>;
    };

    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-hermes", "Needs approval", {
      companyId: "company-1",
      authorityPolicy: "approval",
      useAdapterRuntime: true,
    });

    expect(result.runStatus).toBe("approval_pending");
    expect(result.approvalId).toBe("approval-adapter-1");
    expect(result.adapterType).toBe("hermes");
    expect(approvalInserts.length).toBeGreaterThan(0);
    expect(approvalInserts[0]).toHaveProperty("status", "pending");
  });

  it("guardrails still work with adapter runtime", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.insert = vi.fn(() => chain);
        chain.update = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "run-guardrail-adapter",
            agent_id: "agent-hermes",
            company_id: "company-1",
            status: "running",
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
          },
          error: null,
        });
      } else if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-hermes",
            adapter_type: "hermes",
            adapter_config: { model: "anthropic/claude-opus-4.6" },
            company_id: "company-1",
            name: "CEO",
            role: "ceo",
          },
          error: null,
        });
      } else if (table === "agent_execution_logs") {
        chain.insert = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-x" },
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: {
            manifest: { compute_constraints: { budget_usd: 0.001 } },
          },
          error: null,
        });
      } else if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      } else if (table === "issues") {
        chain.update = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
      }

      return chain as unknown as ReturnType<typeof import("@/integrations/supabase/client").supabase.from>;
    };

    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-hermes", "Over budget task", {
      companyId: "company-1",
      spendLimitUsd: 100,
      useAdapterRuntime: true,
    });

    expect(result.runStatus).toBe("guardrail_rejected");
    expect(result.success).toBe(false);
  });

  it("logs adapter type in loop_start execution log", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, logInsertCalls } = buildAdapterLoopMock("run-log-adapter", {
      adapter_type: "hermes",
      adapter_config: { model: "anthropic/claude-opus-4.6" },
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-hermes", "Log adapter test", {
      companyId: "company-1",
      useAdapterRuntime: true,
    });

    // Find the loop_start log
    const loopStartLog = logInsertCalls.find((log) => {
      const content = log.content as Record<string, unknown> | undefined;
      return content && (content as Record<string, unknown>).action === "loop_start";
    });

    expect(loopStartLog).toBeDefined();
    const content = loopStartLog!.content as Record<string, unknown>;
    expect(content.adapterType).toBe("hermes");
  });
});

/* ================================================================
   Index re-exports
   ================================================================ */

describe("agent-loop adapter-runtime exports", () => {
  it("exports resolveAdapterRuntime", async () => {
    const mod = await import("@/lib/agent-loop/adapter-runtime");
    expect(typeof mod.resolveAdapterRuntime).toBe("function");
  });

  it("exports executeAdapterStep", async () => {
    const mod = await import("@/lib/agent-loop/adapter-runtime");
    expect(typeof mod.executeAdapterStep).toBe("function");
  });
});
