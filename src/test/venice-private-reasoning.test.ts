/**
 * Venice Private Reasoning — Tests
 *
 * Tests for the private-cognition Venice integration:
 * 1. Adapter runtime resolves Venice context when private_cognition_enabled
 * 2. Venice-backed steps route through the Venice client path
 * 3. Operator-visible execution logs redact private reasoning content
 * 4. Run log export (agent_log.json) redacts private reasoning content
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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
   Private Reasoning — Redaction utility
   ================================================================ */

describe("redactPrivateReasoning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces venice_reasoning content with redaction placeholder", async () => {
    const { redactPrivateReasoning } = await import(
      "@/lib/venice/private-reasoning"
    );

    const content = {
      action: "step_complete",
      step: "discover",
      venice_reasoning: "This is the secret reasoning that should not be visible",
      adapterType: "hermes",
    };

    const redacted = redactPrivateReasoning(content);

    expect(redacted.venice_reasoning).toBe("[Private Reasoning Redacted]");
    expect(redacted.action).toBe("step_complete");
    expect(redacted.adapterType).toBe("hermes");
  });

  it("replaces nested venice_reasoning in data objects", async () => {
    const { redactPrivateReasoning } = await import(
      "@/lib/venice/private-reasoning"
    );

    const content = {
      action: "step_complete",
      data: {
        venice_reasoning: "Deep secret reasoning",
        other_field: "visible",
      },
    };

    const redacted = redactPrivateReasoning(content);

    expect(
      (redacted.data as Record<string, unknown>).venice_reasoning,
    ).toBe("[Private Reasoning Redacted]");
    expect((redacted.data as Record<string, unknown>).other_field).toBe(
      "visible",
    );
  });

  it("leaves content unchanged when no venice_reasoning is present", async () => {
    const { redactPrivateReasoning } = await import(
      "@/lib/venice/private-reasoning"
    );

    const content = {
      action: "step_complete",
      step: "plan",
      someData: "public info",
    };

    const redacted = redactPrivateReasoning(content);

    expect(redacted).toEqual(content);
  });

  it("redacts private_reasoning_content field as well", async () => {
    const { redactPrivateReasoning } = await import(
      "@/lib/venice/private-reasoning"
    );

    const content = {
      action: "step_complete",
      private_reasoning_content: "This internal thought process is private",
      result: "visible output",
    };

    const redacted = redactPrivateReasoning(content);

    expect(redacted.private_reasoning_content).toBe(
      "[Private Reasoning Redacted]",
    );
    expect(redacted.result).toBe("visible output");
  });

  it("handles null and undefined content gracefully", async () => {
    const { redactPrivateReasoning } = await import(
      "@/lib/venice/private-reasoning"
    );

    expect(redactPrivateReasoning(null as unknown as Record<string, unknown>)).toEqual({});
    expect(redactPrivateReasoning(undefined as unknown as Record<string, unknown>)).toEqual({});
  });
});

/* ================================================================
   Private Reasoning — Venice-backed adapter step execution
   ================================================================ */

describe("executeVeniceStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("produces discover output tagged with Venice routing metadata", async () => {
    const { executeVeniceStep } = await import(
      "@/lib/venice/private-reasoning"
    );

    const result = await executeVeniceStep("discover", {
      task: "Analyze a contract for vulnerabilities",
      veniceModel: "deepseek-r1-671b",
      agentName: "Security Agent",
      agentRole: "security",
      adapterType: "hermes",
    });

    expect(result).toHaveProperty("taskAnalysis");
    expect(result).toHaveProperty("veniceRouted", true);
    expect(result).toHaveProperty("veniceModel", "deepseek-r1-671b");
    // Private reasoning content should be present but is the raw step output
    // Redaction happens at the logging layer, not here
    expect(result).toHaveProperty("privateCognitionEnabled", true);
  });

  it("produces plan output with Venice model context", async () => {
    const { executeVeniceStep } = await import(
      "@/lib/venice/private-reasoning"
    );

    const result = await executeVeniceStep("plan", {
      task: "Review code changes",
      veniceModel: "llama-3.3-70b",
      agentName: "Reviewer",
      agentRole: "reviewer",
      adapterType: "hermes",
      previousSteps: [
        {
          step: "discover",
          success: true,
          data: { estimatedSteps: 2 },
        },
      ],
    });

    expect(result).toHaveProperty("subtasks");
    expect(result).toHaveProperty("veniceRouted", true);
    const subtasks = (result as { subtasks: Array<{ veniceModel?: string }> })
      .subtasks;
    expect(subtasks.length).toBeGreaterThan(0);
  });

  it("produces execute output with Venice-redactable reasoning marker", async () => {
    const { executeVeniceStep } = await import(
      "@/lib/venice/private-reasoning"
    );

    const result = await executeVeniceStep("execute", {
      task: "Execute action plan",
      veniceModel: "llama-3.3-70b",
      agentName: "Worker",
      agentRole: "engineer",
      adapterType: "hermes",
      previousSteps: [
        { step: "discover", success: true, data: {} },
        {
          step: "plan",
          success: true,
          data: {
            subtasks: [
              { id: "st-1", description: "Step 1", status: "pending" },
            ],
          },
        },
      ],
    });

    expect(result).toHaveProperty("veniceRouted", true);
    expect(result).toHaveProperty("venice_reasoning");
    // The raw reasoning is present in the step result — redaction happens at log time
    expect(typeof (result as Record<string, unknown>).venice_reasoning).toBe(
      "string",
    );
  });

  it("produces verify output with Venice validation metadata", async () => {
    const { executeVeniceStep } = await import(
      "@/lib/venice/private-reasoning"
    );

    const result = await executeVeniceStep("verify", {
      task: "Verify results",
      veniceModel: "llama-3.3-70b",
      agentName: "QA",
      agentRole: "analyst",
      adapterType: "hermes",
      previousSteps: [
        { step: "discover", success: true, data: {} },
        { step: "plan", success: true, data: { subtasks: [] } },
        {
          step: "execute",
          success: true,
          data: { completedSubtasks: [] },
        },
      ],
    });

    expect(result).toHaveProperty("verified");
    expect(result).toHaveProperty("veniceRouted", true);
  });
});

/* ================================================================
   Private Reasoning — resolveAdapterRuntime includes Venice context
   ================================================================ */

describe("resolveAdapterRuntime — Venice private cognition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes Venice context when private_cognition_enabled is true", async () => {
    const { resolveAdapterRuntime } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );
    const { supabase } = await import("@/integrations/supabase/client");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-venice-1",
            adapter_type: "hermes",
            adapter_config: { model: "anthropic/claude-opus-4.6" },
            company_id: "company-1",
            name: "Private Agent",
            role: "ceo",
            private_cognition_enabled: true,
            venice_model: "deepseek-r1-671b",
          },
          error: null,
        });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const ctx = await resolveAdapterRuntime("agent-venice-1");

    expect(ctx.privateCognitionEnabled).toBe(true);
    expect(ctx.veniceModel).toBe("deepseek-r1-671b");
  });

  it("does not include Venice context when private_cognition_enabled is false", async () => {
    const { resolveAdapterRuntime } = await import(
      "@/lib/agent-loop/adapter-runtime"
    );
    const { supabase } = await import("@/integrations/supabase/client");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: "agent-no-venice",
            adapter_type: "hermes",
            adapter_config: { model: "anthropic/claude-opus-4.6" },
            company_id: "company-1",
            name: "Normal Agent",
            role: "ceo",
            private_cognition_enabled: false,
            venice_model: null,
          },
          error: null,
        });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const ctx = await resolveAdapterRuntime("agent-no-venice");

    expect(ctx.privateCognitionEnabled).toBe(false);
    expect(ctx.veniceModel).toBeUndefined();
  });
});

/* ================================================================
   Private Reasoning — Execution log redaction in export
   ================================================================ */

describe("run log export redacts private reasoning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redacts venice_reasoning from exported agent_log.json entries", async () => {
    const { redactRunLogExport } = await import(
      "@/lib/venice/private-reasoning"
    );

    const rawExport = {
      run_id: "run-1",
      agent_id: "agent-1",
      company_id: "company-1",
      status: "completed",
      started_at: "2024-01-01T00:00:00Z",
      finished_at: "2024-01-01T00:01:00Z",
      summary: "Test run",
      usage: {
        total_input_tokens: 100,
        total_output_tokens: 50,
        total_cost_usd: 0.01,
      },
      entries: [
        {
          log_id: "log-1",
          timestamp: "2024-01-01T00:00:10Z",
          type: "output",
          content: {
            action: "step_complete",
            step: "execute",
            venice_reasoning:
              "The private reasoning chain that operators should never see",
            veniceRouted: true,
            result: "Completed analysis",
          },
          agent_id: "agent-1",
          run_id: "run-1",
        },
        {
          log_id: "log-2",
          timestamp: "2024-01-01T00:00:20Z",
          type: "decision",
          content: {
            action: "step_start",
            step: "verify",
          },
          agent_id: "agent-1",
          run_id: "run-1",
        },
      ],
    };

    const redacted = redactRunLogExport(rawExport);

    // First entry's venice_reasoning should be redacted
    expect(redacted.entries[0].content.venice_reasoning).toBe(
      "[Private Reasoning Redacted]",
    );
    // Other fields should be preserved
    expect(redacted.entries[0].content.result).toBe("Completed analysis");
    expect(redacted.entries[0].content.veniceRouted).toBe(true);

    // Second entry should be unchanged (no venice_reasoning)
    expect(redacted.entries[1].content).toEqual({
      action: "step_start",
      step: "verify",
    });

    // Envelope metadata should be preserved
    expect(redacted.run_id).toBe("run-1");
    expect(redacted.status).toBe("completed");
  });
});

/* ================================================================
   Private Reasoning — autonomous loop routes through Venice
   ================================================================ */

describe("runAutonomousLoop — Venice private cognition routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes through Venice when agent has private_cognition_enabled", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

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
            id: "run-venice-1",
            agent_id: "agent-venice",
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
            id: "agent-venice",
            adapter_type: "hermes",
            adapter_config: { model: "anthropic/claude-opus-4.6" },
            company_id: "company-1",
            name: "Venice Agent",
            role: "ceo",
            private_cognition_enabled: true,
            venice_model: "deepseek-r1-671b",
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
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    };

    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop(
      "agent-venice",
      "Analyze contract with private reasoning",
      {
        companyId: "company-1",
        useAdapterRuntime: true,
      },
    );

    expect(result.success).toBe(true);
    expect(result.adapterType).toBe("hermes");

    // Execution logs should have veniceRouted: true entries
    const veniceRoutedLogs = logInsertCalls.filter((log) => {
      const content = log.content as Record<string, unknown> | undefined;
      if (!content) return false;
      // Check in the step data
      const data = content.data as Record<string, unknown> | undefined;
      return (
        content.veniceRouted === true ||
        (data && data.veniceRouted === true)
      );
    });
    expect(veniceRoutedLogs.length).toBeGreaterThan(0);

    // Logs that contain venice_reasoning should have it redacted
    const logsWithReasoning = logInsertCalls.filter((log) => {
      const content = log.content as Record<string, unknown> | undefined;
      if (!content) return false;
      return (
        content.venice_reasoning !== undefined ||
        ((content.data as Record<string, unknown> | undefined)?.venice_reasoning !==
          undefined)
      );
    });

    for (const log of logsWithReasoning) {
      const content = log.content as Record<string, unknown>;
      if (content.venice_reasoning !== undefined) {
        expect(content.venice_reasoning).toBe(
          "[Private Reasoning Redacted]",
        );
      }
      const data = content.data as Record<string, unknown> | undefined;
      if (data?.venice_reasoning !== undefined) {
        expect(data.venice_reasoning).toBe("[Private Reasoning Redacted]");
      }
    }
  });

  it("includes venice routing metadata in loop_start log", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

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
            id: "run-venice-2",
            agent_id: "agent-venice",
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
            id: "agent-venice",
            adapter_type: "hermes",
            adapter_config: {},
            company_id: "company-1",
            name: "Venice Agent",
            role: "ceo",
            private_cognition_enabled: true,
            venice_model: "llama-3.3-70b",
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
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    };

    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-venice", "Venice logging test", {
      companyId: "company-1",
      useAdapterRuntime: true,
    });

    // Find the loop_start log
    const loopStartLog = logInsertCalls.find((log) => {
      const content = log.content as Record<string, unknown> | undefined;
      return content && content.action === "loop_start";
    });

    expect(loopStartLog).toBeDefined();
    const content = loopStartLog!.content as Record<string, unknown>;
    expect(content.privateCognitionEnabled).toBe(true);
    expect(content.veniceModel).toBe("llama-3.3-70b");
  });
});
