import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();
const mockLogExecution = vi.fn().mockResolvedValue(undefined);

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock("@/lib/erc8004/execution-log", () => ({
  logExecution: (...args: unknown[]) => mockLogExecution(...args),
}));

describe("agent-loop support utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validateTransaction enforces unsafe operations, limits, and whitelist checks", async () => {
    const { validateTransaction } = await import("@/lib/agent-loop/guardrails");

    expect(
      validateTransaction(
        { amount: 5, recipient: "0xABC123", operation: "transfer" },
        { maxAmountUsd: 100, recipientWhitelist: ["0xabc123"] },
      ),
    ).toEqual({ valid: true });

    expect(
      validateTransaction(
        { amount: 200, recipient: "0xABC123", operation: "transfer" },
        { maxAmountUsd: 100, recipientWhitelist: [] },
      ),
    ).toMatchObject({ valid: false });

    expect(
      validateTransaction(
        { amount: 5, recipient: "0xBAD", operation: "delegate_all" },
        { maxAmountUsd: 100, recipientWhitelist: [] },
      ),
    ).toMatchObject({
      valid: false,
      reason: expect.stringContaining("Unsafe operation blocked"),
    });
  });

  it("abortOnRepeatedFailure is true once retryCount reaches maxRetries", async () => {
    const { abortOnRepeatedFailure } = await import("@/lib/agent-loop/guardrails");

    expect(abortOnRepeatedFailure(1, 3)).toBe(false);
    expect(abortOnRepeatedFailure(3, 3)).toBe(true);
  });

  it("trackBudget updates run totals and emits a budget log entry", async () => {
    const runRow = {
      total_input_tokens: 10,
      total_output_tokens: 5,
      total_cost_usd: 0.25,
      agent_id: "agent-1",
      company_id: "company-1",
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "runs") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: runRow, error: null }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: () => {
              expect(payload).toMatchObject({
                total_input_tokens: 15,
                total_output_tokens: 8,
                total_cost_usd: 0.4,
              });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { trackBudget } = await import("@/lib/agent-loop/budget");
    await trackBudget("run-1", { input: 5, output: 3 }, 0.15);

    expect(mockLogExecution).toHaveBeenCalledWith(
      "agent-1",
      "company-1",
      "run-1",
      "output",
      expect.objectContaining({
        action: "track_budget",
        totals: expect.objectContaining({
          input_tokens: 15,
          output_tokens: 8,
          cost_usd: 0.4,
        }),
      }),
    );
  });

  it("checkBudgetRemaining uses manifest budget when present and default budget otherwise", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "runs") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [
                  { total_input_tokens: 20, total_output_tokens: 10, total_cost_usd: 1.5 },
                  { total_input_tokens: 5, total_output_tokens: 2, total_cost_usd: 0.5 },
                ],
                error: null,
              }),
          }),
        };
      }

      if (table === "agent_identities") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    manifest: {
                      compute_constraints: { budget_usd: 25 },
                    },
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { checkBudgetRemaining } = await import("@/lib/agent-loop/budget");
    const budget = await checkBudgetRemaining("agent-1");

    expect(budget).toEqual({
      totalSpentUsd: 2,
      totalInputTokens: 25,
      totalOutputTokens: 12,
      maxBudgetUsd: 25,
      remainingUsd: 23,
    });
  });

  it("enforceBudget throws and logs when estimated cost exceeds remaining budget", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "runs") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: [{ total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 9 }],
                error: null,
              }),
          }),
        };
      }

      if (table === "agent_identities") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    manifest: {
                      compute_constraints: { budget_usd: 10 },
                    },
                  },
                  error: null,
                }),
            }),
          }),
        };
      }

      if (table === "agents") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { company_id: "company-1" },
                  error: null,
                }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { enforceBudget } = await import("@/lib/agent-loop/budget");

    await expect(enforceBudget("agent-1", 2)).rejects.toThrow(/Budget exceeded/);
    expect(mockLogExecution).toHaveBeenCalledWith(
      "agent-1",
      "company-1",
      null,
      "failure",
      expect.objectContaining({
        action: "enforce_budget",
        estimatedCost: 2,
      }),
    );
  });

  it("agent-loop index exports support helpers but not legacy execution APIs", async () => {
    const mod = await import("@/lib/agent-loop/index");

    expect(typeof mod.validateTransaction).toBe("function");
    expect(typeof mod.runGuardrailCheck).toBe("function");
    expect(typeof mod.trackBudget).toBe("function");
    expect("runAutonomousLoop" in mod).toBe(false);
    expect("resolveAdapterRuntime" in mod).toBe(false);
    expect("executeAdapterStep" in mod).toBe(false);
  });
});
