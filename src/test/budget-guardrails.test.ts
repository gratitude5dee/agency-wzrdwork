import { describe, expect, it, vi, beforeEach } from "vitest";

/* ---------- Supabase mock ---------- */

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();

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
   runGuardrailCheck — unit tests
   ================================================================ */

describe("runGuardrailCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to set up supabase mocks for budget checks.
   * Returns the list of logged execution entries for inspection.
   */
  function setupBudgetMock(opts: {
    totalSpent: number;
    maxBudget: number;
  }) {
    const logEntries: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.eq = vi.fn().mockResolvedValue({
          data: [
            {
              total_input_tokens: 1000,
              total_output_tokens: 500,
              total_cost_usd: opts.totalSpent,
            },
          ],
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            manifest: {
              compute_constraints: { budget_usd: opts.maxBudget },
            },
          },
          error: null,
        });
      } else if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logEntries.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-1" },
          error: null,
        });
      }

      return chain as unknown as ReturnType<
        typeof import("@/integrations/supabase/client").supabase.from
      >;
    };

    return { mockImpl, logEntries };
  }

  /**
   * Helper for transaction-only checks (no budget).
   */
  function setupTransactionOnlyMock() {
    const logEntries: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logEntries.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-1" },
          error: null,
        });
      }

      return chain as unknown as ReturnType<
        typeof import("@/integrations/supabase/client").supabase.from
      >;
    };

    return { mockImpl, logEntries };
  }

  /* ---- Budget exceeded ---- */

  it("rejects over-budget actions with human-readable reason and budget_exceeded ruleKind", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupBudgetMock({ totalSpent: 9, maxBudget: 10 });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      estimatedCostUsd: 5,
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleKind).toBe("budget_exceeded");
    expect(result.reason).toContain("Budget exceeded");
    expect(result.reason).toContain("$5");
    expect(result.reason).toContain("$1.00");
    expect(result.budgetSnapshot).toBeDefined();
    expect(result.budgetSnapshot?.remainingUsd).toBe(1);
  });

  it("includes a complete budget snapshot on budget rejection", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupBudgetMock({ totalSpent: 8, maxBudget: 10 });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      estimatedCostUsd: 5,
    });

    expect(result.allowed).toBe(false);
    expect(result.budgetSnapshot?.totalSpentUsd).toBe(8);
    expect(result.budgetSnapshot?.maxBudgetUsd).toBe(10);
    expect(result.budgetSnapshot?.remainingUsd).toBe(2);
  });

  /* ---- Budget within limits ---- */

  it("allows actions within budget and includes budget snapshot", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupBudgetMock({ totalSpent: 2, maxBudget: 10 });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      estimatedCostUsd: 3,
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(result.budgetSnapshot?.remainingUsd).toBe(8);
  });

  /* ---- Unsafe operation blocked ---- */

  it("rejects unsafe operations with human-readable reason and unsafe_operation ruleKind", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupTransactionOnlyMock();
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      transaction: {
        amount: 1,
        recipient: "0xABC",
        operation: "drain_wallet",
      },
      spendLimits: { maxAmountUsd: 100, recipientWhitelist: [] },
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleKind).toBe("unsafe_operation");
    expect(result.reason).toContain("Unsafe operation blocked");
    expect(result.reason).toContain("drain_wallet");
  });

  it("rejects all known unsafe operations", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const unsafeOps = [
      "drain_wallet",
      "transfer_all",
      "approve_unlimited",
      "self_destruct",
      "delegate_all",
    ];

    for (const op of unsafeOps) {
      vi.clearAllMocks();
      const { mockImpl } = setupTransactionOnlyMock();
      vi.mocked(supabase.from).mockImplementation(mockImpl);

      const result = await runGuardrailCheck({
        agentId: "agent-1",
        companyId: "company-1",
        runId: "run-1",
        transaction: { amount: 1, recipient: "0xABC", operation: op },
        spendLimits: { maxAmountUsd: 100, recipientWhitelist: [] },
      });

      expect(result.allowed).toBe(false);
      expect(result.ruleKind).toBe("unsafe_operation");
    }
  });

  /* ---- Recipient blocked ---- */

  it("rejects transactions to non-whitelisted recipients", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupTransactionOnlyMock();
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      transaction: {
        amount: 5,
        recipient: "0xUNKNOWN",
        operation: "transfer",
      },
      spendLimits: {
        maxAmountUsd: 100,
        recipientWhitelist: ["0xABC", "0xDEF"],
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleKind).toBe("recipient_blocked");
    expect(result.reason).toContain("not in the whitelist");
  });

  /* ---- Negative amount ---- */

  it("rejects negative transaction amounts", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupTransactionOnlyMock();
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      transaction: {
        amount: -10,
        recipient: "0xABC",
        operation: "transfer",
      },
      spendLimits: { maxAmountUsd: 100, recipientWhitelist: [] },
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleKind).toBe("negative_amount");
    expect(result.reason).toContain("cannot be negative");
  });

  /* ---- Transaction exceeding spend limit ---- */

  it("rejects transactions exceeding spend limits", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupTransactionOnlyMock();
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      transaction: {
        amount: 200,
        recipient: "0xABC",
        operation: "transfer",
      },
      spendLimits: { maxAmountUsd: 100, recipientWhitelist: [] },
    });

    expect(result.allowed).toBe(false);
    expect(result.ruleKind).toBe("budget_exceeded");
    expect(result.reason).toContain("exceeds spend limit");
  });

  /* ---- Safe transaction allowed ---- */

  it("allows safe transactions within limits", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupTransactionOnlyMock();
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      transaction: {
        amount: 5,
        recipient: "0xABC",
        operation: "transfer",
      },
      spendLimits: { maxAmountUsd: 100, recipientWhitelist: ["0xabc"] },
    });

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  /* ---- Logging ---- */

  it("logs guardrail check result to agent_execution_logs as safety_check", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl, logEntries } = setupBudgetMock({
      totalSpent: 9,
      maxBudget: 10,
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      estimatedCostUsd: 5,
    });

    // Should have logged a safety_check entry
    expect(logEntries.length).toBeGreaterThan(0);
    const safetyLog = logEntries.find(
      (e) => e.log_type === "safety_check",
    );
    expect(safetyLog).toBeDefined();

    const content = safetyLog?.content as Record<string, unknown>;
    expect(content.action).toBe("guardrail_check");
    expect(content.allowed).toBe(false);
    expect(content.reason).toContain("Budget exceeded");
    expect(content.ruleKind).toBe("budget_exceeded");
  });

  it("logs allowed results to agent_execution_logs as well", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl, logEntries } = setupBudgetMock({
      totalSpent: 1,
      maxBudget: 10,
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      estimatedCostUsd: 2,
    });

    const safetyLog = logEntries.find(
      (e) => e.log_type === "safety_check",
    );
    expect(safetyLog).toBeDefined();
    const content = safetyLog?.content as Record<string, unknown>;
    expect(content.allowed).toBe(true);
  });

  /* ---- Transaction safety checked before budget ---- */

  it("prioritizes unsafe operation over budget check", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    // Even with budget available, unsafe ops should be blocked
    const { mockImpl } = setupTransactionOnlyMock();
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: "run-1",
      estimatedCostUsd: 1,
      transaction: {
        amount: 1,
        recipient: "0xABC",
        operation: "self_destruct",
      },
      spendLimits: { maxAmountUsd: 100, recipientWhitelist: [] },
    });

    // Should be rejected for unsafe operation, not budget
    expect(result.allowed).toBe(false);
    expect(result.ruleKind).toBe("unsafe_operation");
  });

  /* ---- No checks when nothing is requested ---- */

  it("allows when neither budget nor transaction checks are requested", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runGuardrailCheck } = await import("@/lib/agent-loop/guardrails");

    const { mockImpl } = setupTransactionOnlyMock();
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runGuardrailCheck({
      agentId: "agent-1",
      companyId: "company-1",
      runId: null,
    });

    expect(result.allowed).toBe(true);
  });
});

/* ================================================================
   Autonomous loop — guardrail integration
   ================================================================ */

describe("runAutonomousLoop — budget guardrail integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildGuardrailLoopMock(
    runId: string,
    opts: {
      budgetSpent: number;
      budgetMax: number;
    },
  ) {
    const logInserts: Array<Record<string, unknown>> = [];
    const activityInserts: Array<Record<string, unknown>> = [];
    const runUpdates: Array<Record<string, unknown>> = [];
    const issueUpdates: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.insert = vi.fn(() => chain);
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          runUpdates.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockResolvedValue({
          data: {
            id: runId,
            agent_id: "agent-1",
            company_id: "company-1",
            status: "running",
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
          },
          error: null,
        });

        // For budget check: runs query returns historical spend
        const origEq = chain.eq;
        chain.eq = vi.fn((col: string, val: string) => {
          // Return the chain with spending data when querying by agent_id
          if (col === "agent_id") {
            return {
              ...chain,
              // Direct resolution for budget query (no .single())
              then: (resolve: (val: { data: unknown[]; error: null }) => void) =>
                resolve({
                  data: [
                    {
                      total_input_tokens: 1000,
                      total_output_tokens: 500,
                      total_cost_usd: opts.budgetSpent,
                    },
                  ],
                  error: null,
                }),
            };
          }
          return chain;
        });
      } else if (table === "agent_identities") {
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: {
            manifest: {
              compute_constraints: { budget_usd: opts.budgetMax },
            },
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
      } else if (table === "activity_events") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          activityInserts.push(payload);
          return chain;
        });
      } else if (table === "issues") {
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          issueUpdates.push(payload);
          return chain;
        });
        chain.eq = vi.fn(() => chain);
      }

      return chain as unknown as ReturnType<
        typeof import("@/integrations/supabase/client").supabase.from
      >;
    };

    return { mockImpl, logInserts, activityInserts, runUpdates, issueUpdates };
  }

  it("stops the loop with guardrail_rejected when budget is exceeded", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    // Budget: spent $9 of $10 max, spendLimitUsd = $5 per run
    // Per step = $1, but remaining is $1 so first step should be fine
    // Actually, with maxBudget = 1 and spent = 9, remaining is 0
    const { mockImpl } = buildGuardrailLoopMock("run-guard-1", {
      budgetSpent: 10,
      budgetMax: 10,
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Over budget task", {
      companyId: "company-1",
      spendLimitUsd: 5,
    });

    expect(result.success).toBe(false);
    expect(result.runStatus).toBe("guardrail_rejected");
    // Should have stopped before executing any step
    expect(result.steps.length).toBeLessThanOrEqual(1);
    expect(result.steps[0]?.success).toBe(false);
    expect(result.steps[0]?.error).toContain("Budget exceeded");
  });

  it("records human-readable guardrail reason in the failed step error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl } = buildGuardrailLoopMock("run-guard-2", {
      budgetSpent: 10,
      budgetMax: 10,
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Over budget task", {
      companyId: "company-1",
      spendLimitUsd: 5,
    });

    const failedStep = result.steps.find((s) => !s.success);
    expect(failedStep).toBeDefined();
    expect(failedStep?.error).toContain("Budget exceeded");
    expect(failedStep?.error).toContain("remaining");
  });

  it("creates guardrail_rejected activity event on budget rejection", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, activityInserts } = buildGuardrailLoopMock(
      "run-guard-3",
      {
        budgetSpent: 10,
        budgetMax: 10,
      },
    );
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Over budget task", {
      companyId: "company-1",
      spendLimitUsd: 5,
    });

    const actions = activityInserts.map((e) => e.action);
    expect(actions).toContain("run_started");
    expect(actions).toContain("guardrail_rejected");
    expect(actions).not.toContain("run_completed");
  });

  it("logs guardrail failure to execution logs with failure action", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, logInserts } = buildGuardrailLoopMock("run-guard-4", {
      budgetSpent: 10,
      budgetMax: 10,
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Over budget task", {
      companyId: "company-1",
      spendLimitUsd: 5,
    });

    // Should have a guardrail_rejected failure log entry
    const guardrailLog = logInserts.find(
      (e) =>
        e.log_type === "failure" &&
        (e.content as Record<string, unknown>)?.action === "guardrail_rejected",
    );
    expect(guardrailLog).toBeDefined();

    const content = guardrailLog?.content as Record<string, unknown>;
    expect(content.reason).toContain("Budget exceeded");
    expect(content.step).toBe("discover"); // First step gets rejected
  });

  it("does not execute any step side effects when guardrail rejects", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, logInserts } = buildGuardrailLoopMock("run-guard-5", {
      budgetSpent: 10,
      budgetMax: 10,
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Over budget task", {
      companyId: "company-1",
      spendLimitUsd: 5,
    });

    // Should NOT have any step_start or step_complete log entries
    const stepStarts = logInserts.filter(
      (e) =>
        (e.content as Record<string, unknown>)?.action === "step_start",
    );
    expect(stepStarts).toHaveLength(0);

    const stepCompletes = logInserts.filter(
      (e) =>
        (e.content as Record<string, unknown>)?.action === "step_complete",
    );
    expect(stepCompletes).toHaveLength(0);
  });

  it("records guardrail reason in run update error field", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, runUpdates } = buildGuardrailLoopMock("run-guard-6", {
      budgetSpent: 10,
      budgetMax: 10,
    });
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Over budget task", {
      companyId: "company-1",
      spendLimitUsd: 5,
    });

    // The terminal run update should record the guardrail reason
    const terminalUpdate = runUpdates.find(
      (u) => u.status === "guardrail_rejected",
    );
    expect(terminalUpdate).toBeDefined();
    expect(terminalUpdate?.error).toContain("Guardrail rejected");
    expect(terminalUpdate?.error).toContain("Budget exceeded");
  });
});

/* ================================================================
   Index exports — new guardrail types and functions
   ================================================================ */

describe("agent-loop index — guardrail exports", () => {
  it("exports runGuardrailCheck function", async () => {
    const mod = await import("@/lib/agent-loop/index");
    expect(typeof mod.runGuardrailCheck).toBe("function");
  });

  it("exports GuardrailResult type (loads without error)", async () => {
    // Type-only exports don't have runtime values, but
    // verifying the module loads cleanly confirms the export path
    const mod = await import("@/lib/agent-loop/index");
    expect(mod).toBeDefined();
  });
});
