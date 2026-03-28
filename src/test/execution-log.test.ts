import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

/* ---------- Supabase mock ---------- */

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockLimit = vi.fn();
const mockRange = vi.fn();

function buildChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  chain.single = mockSingle;
  chain.limit = mockLimit.mockReturnValue(chain);
  chain.range = mockRange.mockReturnValue(chain);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => buildChain()),
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

/* ================================================================
   logExecution
   ================================================================ */

describe("logExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an agent_execution_logs row in Supabase with correct fields", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    const mockRow = {
      id: "log-1",
      agent_id: "agent-1",
      company_id: "company-1",
      run_id: "run-1",
      log_type: "decision",
      content: { message: "Chose strategy A" },
      created_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });
      chain.insert = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const { logExecution } = await import("@/lib/erc8004/execution-log");

    const result = await logExecution(
      "agent-1",
      "company-1",
      "run-1",
      "decision",
      { message: "Chose strategy A" },
    );

    expect(supabase.from).toHaveBeenCalledWith("agent_execution_logs");
    expect(result).toEqual(mockRow);
  });

  it("supports all 6 log_type values", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { logExecution } = await import("@/lib/erc8004/execution-log");

    const logTypes = [
      "decision",
      "tool_call",
      "retry",
      "failure",
      "output",
      "safety_check",
    ] as const;

    for (const logType of logTypes) {
      vi.mocked(supabase.from).mockImplementation(() => {
        const chain = buildChain();
        chain.single = vi.fn().mockResolvedValue({
          data: { id: `log-${logType}`, log_type: logType },
          error: null,
        });
        chain.insert = vi.fn(() => chain);
        chain.select = vi.fn(() => chain);
        return chain as unknown as ReturnType<typeof supabase.from>;
      });

      const result = await logExecution("agent-1", "company-1", null, logType, {});
      expect(result.log_type).toBe(logType);
    }
  });

  it("accepts null run_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { logExecution } = await import("@/lib/erc8004/execution-log");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.single = vi.fn().mockResolvedValue({
        data: { id: "log-1", run_id: null },
        error: null,
      });
      chain.insert = vi.fn((payload: unknown) => {
        // Verify null run_id is passed through
        expect((payload as Record<string, unknown>).run_id).toBeNull();
        return chain;
      });
      chain.select = vi.fn(() => chain);
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await logExecution("agent-1", "company-1", null, "output", { data: "test" });
    expect(result.run_id).toBeNull();
  });

  it("throws on Supabase error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { logExecution } = await import("@/lib/erc8004/execution-log");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "insert failed" },
      });
      chain.insert = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(
      logExecution("agent-1", "company-1", null, "failure", {}),
    ).rejects.toThrow("Failed to create execution log");
  });
});

/* ================================================================
   getExecutionLogs
   ================================================================ */

describe("getExecutionLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns logs filtered by agent_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getExecutionLogs } = await import("@/lib/erc8004/execution-log");

    const mockLogs = [
      { id: "log-1", agent_id: "agent-1", log_type: "decision" },
      { id: "log-2", agent_id: "agent-1", log_type: "output" },
    ];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      // Final call resolves with data
      chain.order = vi.fn().mockResolvedValue({ data: mockLogs, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getExecutionLogs("agent-1");
    expect(result).toEqual(mockLogs);
    expect(supabase.from).toHaveBeenCalledWith("agent_execution_logs");
  });

  it("filters by run_id when provided", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getExecutionLogs } = await import("@/lib/erc8004/execution-log");

    const eqCalls: Array<[string, string]> = [];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.eq = vi.fn((col: string, val: string) => {
        eqCalls.push([col, val]);
        return chain;
      });
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await getExecutionLogs("agent-1", { runId: "run-42" });

    expect(eqCalls).toContainEqual(["agent_id", "agent-1"]);
    expect(eqCalls).toContainEqual(["run_id", "run-42"]);
  });

  it("filters by log_type when provided", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getExecutionLogs } = await import("@/lib/erc8004/execution-log");

    const eqCalls: Array<[string, string]> = [];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.eq = vi.fn((col: string, val: string) => {
        eqCalls.push([col, val]);
        return chain;
      });
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await getExecutionLogs("agent-1", { logType: "tool_call" });

    expect(eqCalls).toContainEqual(["agent_id", "agent-1"]);
    expect(eqCalls).toContainEqual(["log_type", "tool_call"]);
  });

  it("throws on Supabase error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getExecutionLogs } = await import("@/lib/erc8004/execution-log");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "query failed" },
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(getExecutionLogs("agent-1")).rejects.toThrow("Failed to fetch execution logs");
  });
});

/* ================================================================
   exportAgentLog
   ================================================================ */

describe("exportAgentLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns JSON matching Protocol Labs agent_log.json format", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { exportAgentLog } = await import("@/lib/erc8004/execution-log");

    const mockLogs = [
      {
        id: "log-1",
        agent_id: "agent-1",
        company_id: "company-1",
        run_id: "run-1",
        log_type: "decision",
        content: { message: "Chose strategy A" },
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        id: "log-2",
        agent_id: "agent-1",
        company_id: "company-1",
        run_id: "run-1",
        log_type: "output",
        content: { result: "success" },
        created_at: "2025-01-01T00:01:00Z",
      },
    ];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.order = vi.fn().mockResolvedValue({ data: mockLogs, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await exportAgentLog("agent-1");

    expect(result).toHaveProperty("entries");
    expect(result.entries).toHaveLength(2);

    // Each entry must have: timestamp, type, content, agent_id, run_id
    for (const entry of result.entries) {
      expect(entry).toHaveProperty("timestamp");
      expect(entry).toHaveProperty("type");
      expect(entry).toHaveProperty("content");
      expect(entry).toHaveProperty("agent_id");
      expect(entry).toHaveProperty("run_id");
    }

    expect(result.entries[0].timestamp).toBe("2025-01-01T00:00:00Z");
    expect(result.entries[0].type).toBe("decision");
    expect(result.entries[0].content).toEqual({ message: "Chose strategy A" });
    expect(result.entries[0].agent_id).toBe("agent-1");
    expect(result.entries[0].run_id).toBe("run-1");
  });

  it("handles empty logs", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { exportAgentLog } = await import("@/lib/erc8004/execution-log");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await exportAgentLog("agent-1");

    expect(result.entries).toEqual([]);
  });
});

/* ================================================================
   exportRunLog (run-scoped Protocol Labs agent_log.json)
   ================================================================ */

describe("exportRunLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns run-scoped agent_log.json envelope with run metadata", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { exportRunLog } = await import("@/lib/erc8004/execution-log");

    const mockRun = {
      id: "run-1",
      agent_id: "agent-1",
      company_id: "company-1",
      status: "completed",
      created_at: "2025-01-01T00:00:00Z",
      finished_at: "2025-01-01T00:05:00Z",
      summary: "Task completed successfully",
      issue_id: "issue-1",
      error: null,
      total_input_tokens: 1000,
      total_output_tokens: 500,
      total_cost_usd: 0.05,
      total_cached_input_tokens: 0,
      stdout_excerpt: null,
      stderr_excerpt: null,
    };

    const mockLogs = [
      {
        id: "log-1",
        agent_id: "agent-1",
        company_id: "company-1",
        run_id: "run-1",
        log_type: "decision",
        content: { message: "Chose strategy A" },
        created_at: "2025-01-01T00:00:10Z",
      },
      {
        id: "log-2",
        agent_id: "agent-1",
        company_id: "company-1",
        run_id: "run-1",
        log_type: "output",
        content: { result: "success" },
        created_at: "2025-01-01T00:04:50Z",
      },
    ];

    let callCount = 0;
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      callCount++;
      const chain = buildChain();

      if (table === "runs") {
        chain.single = vi.fn().mockResolvedValue({ data: mockRun, error: null });
      } else if (table === "agent_execution_logs") {
        chain.order = vi.fn().mockResolvedValue({ data: mockLogs, error: null });
      }

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await exportRunLog("run-1");

    // Must have top-level Protocol Labs envelope fields
    expect(result).toHaveProperty("run_id", "run-1");
    expect(result).toHaveProperty("agent_id", "agent-1");
    expect(result).toHaveProperty("company_id", "company-1");
    expect(result).toHaveProperty("status", "completed");
    expect(result).toHaveProperty("started_at", "2025-01-01T00:00:00Z");
    expect(result).toHaveProperty("finished_at", "2025-01-01T00:05:00Z");
    expect(result).toHaveProperty("entries");

    // Entries should be the run-scoped execution logs
    expect(result.entries).toHaveLength(2);
    for (const entry of result.entries) {
      expect(entry).toHaveProperty("timestamp");
      expect(entry).toHaveProperty("type");
      expect(entry).toHaveProperty("content");
      expect(entry).toHaveProperty("agent_id");
      expect(entry).toHaveProperty("run_id", "run-1");
      expect(entry).toHaveProperty("log_id");
    }

    // Verify specific entry values
    expect(result.entries[0].log_id).toBe("log-1");
    expect(result.entries[0].type).toBe("decision");
    expect(result.entries[1].log_id).toBe("log-2");
    expect(result.entries[1].type).toBe("output");
  });

  it("includes summary and token usage in envelope", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { exportRunLog } = await import("@/lib/erc8004/execution-log");

    const mockRun = {
      id: "run-2",
      agent_id: "agent-1",
      company_id: "company-1",
      status: "completed",
      created_at: "2025-01-01T00:00:00Z",
      finished_at: "2025-01-01T00:10:00Z",
      summary: "Analyzed data and produced report",
      issue_id: null,
      error: null,
      total_input_tokens: 2000,
      total_output_tokens: 800,
      total_cost_usd: 0.08,
      total_cached_input_tokens: 100,
      stdout_excerpt: null,
      stderr_excerpt: null,
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "runs") {
        chain.single = vi.fn().mockResolvedValue({ data: mockRun, error: null });
      } else {
        chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await exportRunLog("run-2");

    expect(result.summary).toBe("Analyzed data and produced report");
    expect(result.usage).toEqual({
      total_input_tokens: 2000,
      total_output_tokens: 800,
      total_cost_usd: 0.08,
    });
  });

  it("throws when run is not found", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { exportRunLog } = await import("@/lib/erc8004/execution-log");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Run not found" },
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(exportRunLog("run-nonexistent")).rejects.toThrow(
      "Failed to fetch run",
    );
  });

  it("returns empty entries array when run has no logs", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { exportRunLog } = await import("@/lib/erc8004/execution-log");

    const mockRun = {
      id: "run-empty",
      agent_id: "agent-1",
      company_id: "company-1",
      status: "running",
      created_at: "2025-01-01T00:00:00Z",
      finished_at: null,
      summary: null,
      issue_id: null,
      error: null,
      total_input_tokens: 0,
      total_output_tokens: 0,
      total_cost_usd: 0,
      total_cached_input_tokens: 0,
      stdout_excerpt: null,
      stderr_excerpt: null,
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "runs") {
        chain.single = vi.fn().mockResolvedValue({ data: mockRun, error: null });
      } else {
        chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await exportRunLog("run-empty");

    expect(result.run_id).toBe("run-empty");
    expect(result.entries).toEqual([]);
    expect(result.finished_at).toBeNull();
    expect(result.summary).toBeNull();
  });

  it("entries map back to persisted log rows via log_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { exportRunLog } = await import("@/lib/erc8004/execution-log");

    const mockRun = {
      id: "run-trace",
      agent_id: "agent-1",
      company_id: "company-1",
      status: "completed",
      created_at: "2025-01-01T00:00:00Z",
      finished_at: "2025-01-01T00:01:00Z",
      summary: null,
      issue_id: null,
      error: null,
      total_input_tokens: 100,
      total_output_tokens: 50,
      total_cost_usd: 0.01,
      total_cached_input_tokens: 0,
      stdout_excerpt: null,
      stderr_excerpt: null,
    };

    const mockLogs = [
      {
        id: "log-abc",
        agent_id: "agent-1",
        company_id: "company-1",
        run_id: "run-trace",
        log_type: "tool_call",
        content: { tool: "search", args: { query: "test" } },
        created_at: "2025-01-01T00:00:30Z",
      },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "runs") {
        chain.single = vi.fn().mockResolvedValue({ data: mockRun, error: null });
      } else {
        chain.order = vi.fn().mockResolvedValue({ data: mockLogs, error: null });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await exportRunLog("run-trace");

    // Each entry must have a log_id that maps back to the agent_execution_logs row
    expect(result.entries[0].log_id).toBe("log-abc");
    expect(result.entries[0].run_id).toBe("run-trace");
    expect(result.entries[0].agent_id).toBe("agent-1");
  });
});

/* ================================================================
   useExecutionLogs Hook
   ================================================================ */

describe("useExecutionLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined data when agentId is undefined", async () => {
    const { useExecutionLogs } = await import("@/hooks/useExecutionLogs");

    const { result } = renderHook(() => useExecutionLogs(undefined), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it("queries execution logs for a given agent", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { useExecutionLogs } = await import("@/hooks/useExecutionLogs");

    const mockLogs = [
      { id: "log-1", agent_id: "agent-1", log_type: "decision", content: {} },
    ];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.range = vi.fn().mockResolvedValue({ data: mockLogs, error: null, count: 1 });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const { result } = renderHook(() => useExecutionLogs("agent-1"), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });

  it("supports filtering by runId and logType", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { useExecutionLogs } = await import("@/hooks/useExecutionLogs");

    const eqCalls: Array<[string, string]> = [];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.eq = vi.fn((col: string, val: string) => {
        eqCalls.push([col, val]);
        return chain;
      });
      chain.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    renderHook(
      () => useExecutionLogs("agent-1", { runId: "run-5", logType: "tool_call" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(eqCalls).toContainEqual(["agent_id", "agent-1"]);
      expect(eqCalls).toContainEqual(["run_id", "run-5"]);
      expect(eqCalls).toContainEqual(["log_type", "tool_call"]);
    });
  });
});

/* ================================================================
   Index re-exports
   ================================================================ */

describe("ERC-8004 index execution-log exports", () => {
  it("exports logExecution function", async () => {
    const mod = await import("@/lib/erc8004/index");
    expect(typeof mod.logExecution).toBe("function");
  });

  it("exports getExecutionLogs function", async () => {
    const mod = await import("@/lib/erc8004/index");
    expect(typeof mod.getExecutionLogs).toBe("function");
  });

  it("exports exportAgentLog function", async () => {
    const mod = await import("@/lib/erc8004/index");
    expect(typeof mod.exportAgentLog).toBe("function");
  });

  it("exports exportRunLog function", async () => {
    const mod = await import("@/lib/erc8004/index");
    expect(typeof mod.exportRunLog).toBe("function");
  });
});
