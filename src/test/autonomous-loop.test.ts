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
   guardrails — validateTransaction
   ================================================================ */

describe("validateTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid for normal transaction within limits", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const result = validateTransaction(
      { amount: 5, recipient: "0xABC123", operation: "transfer" },
      { maxAmountUsd: 100, recipientWhitelist: ["0xabc123"] },
    );

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects amount exceeding spend limit", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const result = validateTransaction(
      { amount: 150, recipient: "0xABC", operation: "transfer" },
      { maxAmountUsd: 100, recipientWhitelist: [] },
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("exceeds spend limit");
  });

  it("rejects negative amount", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const result = validateTransaction(
      { amount: -10, recipient: "0xABC", operation: "transfer" },
      { maxAmountUsd: 100, recipientWhitelist: [] },
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("cannot be negative");
  });

  it("rejects recipient not in whitelist", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const result = validateTransaction(
      { amount: 5, recipient: "0xUNKNOWN", operation: "transfer" },
      { maxAmountUsd: 100, recipientWhitelist: ["0xABC", "0xDEF"] },
    );

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not in the whitelist");
  });

  it("allows any recipient when whitelist is empty", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const result = validateTransaction(
      { amount: 5, recipient: "0xANYONE", operation: "transfer" },
      { maxAmountUsd: 100, recipientWhitelist: [] },
    );

    expect(result.valid).toBe(true);
  });

  it("performs case-insensitive whitelist check", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const result = validateTransaction(
      { amount: 5, recipient: "0xAbC123", operation: "transfer" },
      { maxAmountUsd: 100, recipientWhitelist: ["0xabc123"] },
    );

    expect(result.valid).toBe(true);
  });

  it("blocks unsafe operations like drain_wallet", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const unsafeOps = [
      "drain_wallet",
      "transfer_all",
      "approve_unlimited",
      "self_destruct",
      "delegate_all",
    ];

    for (const op of unsafeOps) {
      const result = validateTransaction(
        { amount: 1, recipient: "0xABC", operation: op },
        { maxAmountUsd: 100, recipientWhitelist: [] },
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Unsafe operation blocked");
    }
  });

  it("allows safe operations", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    const safeOps = ["transfer", "swap", "approve", "stake"];

    for (const op of safeOps) {
      const result = validateTransaction(
        { amount: 1, recipient: "0xABC", operation: op },
        { maxAmountUsd: 100, recipientWhitelist: [] },
      );

      expect(result.valid).toBe(true);
    }
  });
});

/* ================================================================
   guardrails — abortOnRepeatedFailure
   ================================================================ */

describe("abortOnRepeatedFailure", () => {
  it("returns false when retryCount < maxRetries", async () => {
    const { abortOnRepeatedFailure } = await import(
      "@/lib/agent-loop/guardrails"
    );

    expect(abortOnRepeatedFailure(0, 3)).toBe(false);
    expect(abortOnRepeatedFailure(1, 3)).toBe(false);
    expect(abortOnRepeatedFailure(2, 3)).toBe(false);
  });

  it("returns true when retryCount >= maxRetries", async () => {
    const { abortOnRepeatedFailure } = await import(
      "@/lib/agent-loop/guardrails"
    );

    expect(abortOnRepeatedFailure(3, 3)).toBe(true);
    expect(abortOnRepeatedFailure(5, 3)).toBe(true);
  });

  it("handles edge case of maxRetries = 0 (no retries allowed)", async () => {
    const { abortOnRepeatedFailure } = await import(
      "@/lib/agent-loop/guardrails"
    );

    expect(abortOnRepeatedFailure(0, 0)).toBe(true);
  });
});

/* ================================================================
   budget — trackBudget
   ================================================================ */

describe("trackBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates runs table with token/cost data", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { trackBudget } = await import("@/lib/agent-loop/budget");

    // First call: fetch current run
    // Second call: update run
    // Third call: logExecution (from→insert)
    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      callCount++;
      const chain = buildChain();

      if (table === "runs" && callCount === 1) {
        // fetch current run
        chain.single = vi.fn().mockResolvedValue({
          data: {
            total_input_tokens: 100,
            total_output_tokens: 50,
            total_cost_usd: 0.01,
            agent_id: "agent-1",
            company_id: "company-1",
          },
          error: null,
        });
      } else if (table === "runs" && callCount === 2) {
        // update run
        chain.eq = vi.fn().mockResolvedValue({ error: null });
      } else {
        // logExecution insert
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-1" },
          error: null,
        });
        chain.insert = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await trackBudget("run-1", { input: 200, output: 100 }, 0.02);

    // Should have called supabase.from("runs") at least twice (fetch + update)
    expect(vi.mocked(supabase.from)).toHaveBeenCalledWith("runs");
  });

  it("throws when run is not found", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { trackBudget } = await import("@/lib/agent-loop/budget");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "not found" },
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(
      trackBudget("run-missing", { input: 100, output: 50 }, 0.01),
    ).rejects.toThrow("Failed to fetch run");
  });
});

/* ================================================================
   budget — checkBudgetRemaining
   ================================================================ */

describe("checkBudgetRemaining", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calculates remaining budget from historical runs", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { checkBudgetRemaining } = await import("@/lib/agent-loop/budget");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        // Return runs with costs
        chain.eq = vi.fn().mockResolvedValue({
          data: [
            {
              total_input_tokens: 1000,
              total_output_tokens: 500,
              total_cost_usd: 2.5,
            },
            {
              total_input_tokens: 800,
              total_output_tokens: 300,
              total_cost_usd: 1.5,
            },
          ],
          error: null,
        });
      } else if (table === "agent_identities") {
        // Return identity with budget config
        chain.single = vi.fn().mockResolvedValue({
          data: {
            manifest: {
              compute_constraints: { budget_usd: 20 },
            },
          },
          error: null,
        });
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const budget = await checkBudgetRemaining("agent-1");

    expect(budget.totalSpentUsd).toBe(4.0);
    expect(budget.totalInputTokens).toBe(1800);
    expect(budget.totalOutputTokens).toBe(800);
    expect(budget.maxBudgetUsd).toBe(20);
    expect(budget.remainingUsd).toBe(16);
  });

  it("uses default budget when no identity manifest exists", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { checkBudgetRemaining } = await import("@/lib/agent-loop/budget");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.eq = vi.fn().mockResolvedValue({
          data: [{ total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0 }],
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.single = vi.fn().mockResolvedValue({
          data: null,
          error: { message: "not found" },
        });
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const budget = await checkBudgetRemaining("agent-1");

    // Default max budget is 10 USD
    expect(budget.maxBudgetUsd).toBe(10);
    expect(budget.remainingUsd).toBe(10);
  });

  it("returns 0 remaining when budget is exhausted", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { checkBudgetRemaining } = await import("@/lib/agent-loop/budget");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.eq = vi.fn().mockResolvedValue({
          data: [{ total_input_tokens: 5000, total_output_tokens: 3000, total_cost_usd: 15 }],
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            manifest: {
              compute_constraints: { budget_usd: 10 },
            },
          },
          error: null,
        });
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const budget = await checkBudgetRemaining("agent-1");

    expect(budget.remainingUsd).toBe(0); // Math.max(0, 10 - 15) = 0
    expect(budget.totalSpentUsd).toBe(15);
  });
});

/* ================================================================
   budget — enforceBudget
   ================================================================ */

describe("enforceBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when budget would be exceeded", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { enforceBudget } = await import("@/lib/agent-loop/budget");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.eq = vi.fn().mockResolvedValue({
          data: [{ total_input_tokens: 5000, total_output_tokens: 3000, total_cost_usd: 9 }],
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            manifest: { compute_constraints: { budget_usd: 10 } },
          },
          error: null,
        });
      } else if (table === "agents") {
        chain.single = vi.fn().mockResolvedValue({
          data: { company_id: "company-1" },
          error: null,
        });
      } else if (table === "agent_execution_logs") {
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "log-1" },
          error: null,
        });
        chain.insert = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    // Remaining budget is $1, but trying to spend $5
    await expect(enforceBudget("agent-1", 5)).rejects.toThrow(
      "Budget exceeded",
    );
  });

  it("does not throw when budget has room", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { enforceBudget } = await import("@/lib/agent-loop/budget");

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.eq = vi.fn().mockResolvedValue({
          data: [{ total_input_tokens: 100, total_output_tokens: 50, total_cost_usd: 1 }],
          error: null,
        });
      } else if (table === "agent_identities") {
        chain.single = vi.fn().mockResolvedValue({
          data: {
            manifest: { compute_constraints: { budget_usd: 10 } },
          },
          error: null,
        });
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    // Remaining budget is $9, trying to spend $2 — should be fine
    await expect(enforceBudget("agent-1", 2)).resolves.toBeUndefined();
  });
});

/* ================================================================
   autonomousLoop — runAutonomousLoop (basic loop behavior)
   ================================================================ */

describe("runAutonomousLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper to build a mock for supabase.from() that handles the complex
   * chaining needed by the autonomous loop (runs insert, runs select for
   * trackBudget, runs update, agent_execution_logs inserts, activity_events
   * inserts, issues update, approvals insert).
   */
  function buildLoopMock(runId: string, opts?: { approvalId?: string }) {
    const logInsertCalls: Array<Record<string, unknown>> = [];
    const logTypes: string[] = [];
    const activityInserts: Array<Record<string, unknown>> = [];
    const issueUpdates: Array<Record<string, unknown>> = [];
    const approvalInserts: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.insert = vi.fn(() => chain);
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
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
      } else if (table === "agent_execution_logs") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          logInsertCalls.push(payload);
          if (payload.log_type) {
            logTypes.push(payload.log_type as string);
          }
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
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          issueUpdates.push(payload);
          return chain;
        });
        chain.eq = vi.fn(() => chain);
      } else if (table === "approvals") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          approvalInserts.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: opts?.approvalId ?? "approval-1" },
          error: null,
        });
      }

      return chain as unknown as ReturnType<typeof import("@/integrations/supabase/client").supabase.from>;
    };

    return { mockImpl, logInsertCalls, logTypes, activityInserts, issueUpdates, approvalInserts };
  }

  it("implements 5-step cycle: discover, plan, execute, verify, submit", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, logInsertCalls } = buildLoopMock("run-test-1");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Test task", {
      companyId: "company-1",
    });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(5);
    expect(result.steps.map((s) => s.step)).toEqual([
      "discover",
      "plan",
      "execute",
      "verify",
      "submit",
    ]);

    // All steps should be successful
    for (const step of result.steps) {
      expect(step.success).toBe(true);
    }

    // Should have created execution log entries
    expect(logInsertCalls.length).toBeGreaterThan(0);
  });

  it("creates execution log entries with appropriate log_type for each step", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, logTypes } = buildLoopMock("run-test-2");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Test task", {
      companyId: "company-1",
    });

    // Should have logged multiple types: decision, tool_call, output, safety_check
    expect(logTypes).toContain("decision");
    expect(logTypes).toContain("tool_call");
    expect(logTypes).toContain("output");
    expect(logTypes).toContain("safety_check");
  });

  it("returns structured LoopResult with runStatus", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl } = buildLoopMock("run-test-3");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "My task", {
      companyId: "company-1",
    });

    expect(result).toHaveProperty("runId");
    expect(result).toHaveProperty("agentId", "agent-1");
    expect(result).toHaveProperty("task", "My task");
    expect(result).toHaveProperty("steps");
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("totalTokensUsed");
    expect(result).toHaveProperty("totalCostUsd");
    expect(result).toHaveProperty("runStatus", "completed");
    expect(result.totalTokensUsed).toBeGreaterThan(0);
    expect(result.totalCostUsd).toBeGreaterThan(0);
  });
});

/* ================================================================
   autonomousLoop — issue linkage
   ================================================================ */

describe("runAutonomousLoop — issue linkage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildLoopMock(runId: string) {
    const activityInserts: Array<Record<string, unknown>> = [];
    const issueUpdates: Array<Record<string, unknown>> = [];
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

    return { mockImpl, activityInserts, issueUpdates, runInserts };
  }

  it("links the run to the issue via issue_id when provided", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, runInserts } = buildLoopMock("run-issue-1");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Fix bug", {
      companyId: "company-1",
      issueId: "issue-42",
    });

    // The run insert should include issue_id
    expect(runInserts.length).toBeGreaterThan(0);
    expect(runInserts[0]).toHaveProperty("issue_id", "issue-42");
    expect(result.issueId).toBe("issue-42");
  });

  it("updates issue status to in_progress at start and done on completion", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, issueUpdates } = buildLoopMock("run-issue-2");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Complete task", {
      companyId: "company-1",
      issueId: "issue-55",
    });

    // Should have at least 2 issue updates: in_progress at start, done at end
    expect(issueUpdates.length).toBeGreaterThanOrEqual(2);

    const statuses = issueUpdates.map((u) => u.status);
    expect(statuses[0]).toBe("in_progress");
    expect(statuses[statuses.length - 1]).toBe("done");
  });

  it("creates activity events with the issue_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, activityInserts } = buildLoopMock("run-issue-3");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Analyze data", {
      companyId: "company-1",
      issueId: "issue-99",
    });

    // Activity events should reference the issue
    expect(activityInserts.length).toBeGreaterThanOrEqual(2);
    for (const evt of activityInserts) {
      expect(evt.issue_id).toBe("issue-99");
      expect(evt.company_id).toBe("company-1");
      expect(evt.agent_id).toBe("agent-1");
    }
  });

  it("does not update issues when no issueId is provided", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, issueUpdates } = buildLoopMock("run-no-issue");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "General task", {
      companyId: "company-1",
    });

    // No issue updates when no issueId
    expect(issueUpdates).toHaveLength(0);
  });

  it("returns issueId in the result when provided", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl } = buildLoopMock("run-result-issue");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Task", {
      companyId: "company-1",
      issueId: "issue-77",
    });

    expect(result.issueId).toBe("issue-77");
    expect(result.runStatus).toBe("completed");
  });
});

/* ================================================================
   autonomousLoop — activity events
   ================================================================ */

describe("runAutonomousLoop — activity events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildLoopMock(runId: string) {
    const activityInserts: Array<Record<string, unknown>> = [];

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
            agent_id: "agent-1",
            company_id: "company-1",
            status: "running",
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
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
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          activityInserts.push(payload);
          return chain;
        });
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

    return { mockImpl, activityInserts };
  }

  it("creates run_started and run_completed activity events on success", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, activityInserts } = buildLoopMock("run-act-1");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Do something", {
      companyId: "company-1",
    });

    const actions = activityInserts.map((e) => e.action);
    expect(actions).toContain("run_started");
    expect(actions).toContain("run_completed");
  });

  it("creates approval_required activity event when authority is approval", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, activityInserts } = buildLoopMock("run-act-2");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Sensitive task", {
      companyId: "company-1",
      authorityPolicy: "approval",
    });

    const actions = activityInserts.map((e) => e.action);
    expect(actions).toContain("run_started");
    expect(actions).toContain("approval_required");
    // Should NOT have run_completed when approval is required
    expect(actions).not.toContain("run_completed");
  });

  it("activity events reference company and agent", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, activityInserts } = buildLoopMock("run-act-3");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Task", {
      companyId: "company-1",
    });

    for (const evt of activityInserts) {
      expect(evt.company_id).toBe("company-1");
      expect(evt.agent_id).toBe("agent-1");
    }
  });
});

/* ================================================================
   autonomousLoop — approval lifecycle
   ================================================================ */

describe("runAutonomousLoop — approval lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function buildLoopMock(runId: string, approvalId: string) {
    const approvalInserts: Array<Record<string, unknown>> = [];
    const issueUpdates: Array<Record<string, unknown>> = [];
    const runUpdates: Array<Record<string, unknown>> = [];

    const mockImpl = (table: string) => {
      const chain = buildChain();

      if (table === "runs") {
        chain.insert = vi.fn(() => chain);
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          runUpdates.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
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
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          issueUpdates.push(payload);
          return chain;
        });
        chain.eq = vi.fn(() => chain);
      } else if (table === "approvals") {
        chain.insert = vi.fn((payload: Record<string, unknown>) => {
          approvalInserts.push(payload);
          return chain;
        });
        chain.select = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: approvalId },
          error: null,
        });
      }

      return chain as unknown as ReturnType<typeof import("@/integrations/supabase/client").supabase.from>;
    };

    return { mockImpl, approvalInserts, issueUpdates, runUpdates };
  }

  it("creates approval record when authority policy is approval", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, approvalInserts } = buildLoopMock("run-appr-1", "approval-xyz");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Need approval", {
      companyId: "company-1",
      authorityPolicy: "approval",
    });

    expect(approvalInserts.length).toBeGreaterThan(0);
    expect(approvalInserts[0]).toHaveProperty("status", "pending");
    expect(approvalInserts[0]).toHaveProperty("company_id", "company-1");
    expect(approvalInserts[0]).toHaveProperty("requested_by_agent_id", "agent-1");
    expect(result.approvalId).toBe("approval-xyz");
    expect(result.runStatus).toBe("approval_pending");
  });

  it("does not create approval when authority policy is auto", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, approvalInserts } = buildLoopMock("run-auto-1", "unused");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Auto task", {
      companyId: "company-1",
      authorityPolicy: "auto",
    });

    expect(approvalInserts).toHaveLength(0);
    expect(result.approvalId).toBeUndefined();
    expect(result.runStatus).toBe("completed");
  });

  it("defaults to auto authority policy when not specified", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, approvalInserts } = buildLoopMock("run-default-1", "unused");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Default policy", {
      companyId: "company-1",
    });

    expect(approvalInserts).toHaveLength(0);
    expect(result.runStatus).toBe("completed");
  });

  it("links approval to the issue when issueId is provided", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, approvalInserts } = buildLoopMock("run-appr-2", "approval-issue");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Approval with issue", {
      companyId: "company-1",
      issueId: "issue-33",
      authorityPolicy: "approval",
    });

    expect(approvalInserts[0]).toHaveProperty("issue_id", "issue-33");
    expect(result.issueId).toBe("issue-33");
    expect(result.approvalId).toBe("approval-issue");
  });

  it("sets issue status to in_review when approval is required", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, issueUpdates } = buildLoopMock("run-appr-3", "approval-review");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    await runAutonomousLoop("agent-1", "Needs review", {
      companyId: "company-1",
      issueId: "issue-44",
      authorityPolicy: "approval",
    });

    const statuses = issueUpdates.map((u) => u.status);
    expect(statuses[0]).toBe("in_progress");
    expect(statuses[statuses.length - 1]).toBe("in_review");
  });

  it("sets run status to approval_pending with null finished_at", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const { mockImpl, runUpdates } = buildLoopMock("run-appr-4", "approval-pend");
    vi.mocked(supabase.from).mockImplementation(mockImpl);

    const result = await runAutonomousLoop("agent-1", "Pending", {
      companyId: "company-1",
      authorityPolicy: "approval",
    });

    expect(result.runStatus).toBe("approval_pending");

    // The run update should have null finished_at for approval_pending
    const terminalUpdate = runUpdates.find(
      (u) => u.status === "approval_pending",
    );
    expect(terminalUpdate).toBeDefined();
    expect(terminalUpdate?.finished_at).toBeNull();
  });
});

/* ================================================================
   autonomousLoop — shared ID coherence
   ================================================================ */

describe("runAutonomousLoop — shared ID coherence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("run, activity events, and execution logs all share the same company, agent, and issue IDs", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { runAutonomousLoop } = await import(
      "@/lib/agent-loop/autonomousLoop"
    );

    const activityInserts: Array<Record<string, unknown>> = [];
    const logInserts: Array<Record<string, unknown>> = [];
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
            id: "run-shared",
            agent_id: "agent-1",
            company_id: "company-1",
            status: "running",
            total_input_tokens: 0,
            total_output_tokens: 0,
            total_cost_usd: 0,
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

    const result = await runAutonomousLoop("agent-1", "Coherence test", {
      companyId: "company-1",
      issueId: "issue-shared",
    });

    // Result should have the same IDs
    expect(result.runId).toBe("run-shared");
    expect(result.agentId).toBe("agent-1");
    expect(result.issueId).toBe("issue-shared");

    // Run insert should have matching IDs
    expect(runInserts[0]).toHaveProperty("agent_id", "agent-1");
    expect(runInserts[0]).toHaveProperty("company_id", "company-1");
    expect(runInserts[0]).toHaveProperty("issue_id", "issue-shared");

    // Activity events should have matching IDs
    for (const evt of activityInserts) {
      expect(evt.company_id).toBe("company-1");
      expect(evt.agent_id).toBe("agent-1");
      expect(evt.issue_id).toBe("issue-shared");
    }

    // Execution logs should have matching IDs
    for (const log of logInserts) {
      expect(log.company_id).toBe("company-1");
      expect(log.agent_id).toBe("agent-1");
      expect(log.run_id).toBe("run-shared");
    }
  });
});

/* ================================================================
   Index re-exports
   ================================================================ */

describe("agent-loop index exports", () => {
  it("exports runAutonomousLoop", async () => {
    const mod = await import("@/lib/agent-loop/index");
    expect(typeof mod.runAutonomousLoop).toBe("function");
  });

  it("exports validateTransaction", async () => {
    const mod = await import("@/lib/agent-loop/index");
    expect(typeof mod.validateTransaction).toBe("function");
  });

  it("exports abortOnRepeatedFailure", async () => {
    const mod = await import("@/lib/agent-loop/index");
    expect(typeof mod.abortOnRepeatedFailure).toBe("function");
  });

  it("exports trackBudget", async () => {
    const mod = await import("@/lib/agent-loop/index");
    expect(typeof mod.trackBudget).toBe("function");
  });

  it("exports checkBudgetRemaining", async () => {
    const mod = await import("@/lib/agent-loop/index");
    expect(typeof mod.checkBudgetRemaining).toBe("function");
  });

  it("exports enforceBudget", async () => {
    const mod = await import("@/lib/agent-loop/index");
    expect(typeof mod.enforceBudget).toBe("function");
  });

  it("exports AuthorityPolicy type (via runtime check of type re-export)", async () => {
    // AuthorityPolicy is a type-only export; verify that the module loads cleanly
    const mod = await import("@/lib/agent-loop/index");
    expect(mod).toBeDefined();
  });
});
