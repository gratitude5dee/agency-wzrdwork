/**
 * Bankr Inference Flow — Tests
 *
 * Tests for the orchestrated Bankr inference flow that:
 * 1. Persists Bankr config for a company
 * 2. Routes inference through BankrGateway (edge function proxy)
 * 3. Records model, token usage, and spend evidence in
 *    agent_execution_logs and activity_events
 *
 * Covers:
 * - Config persistence (load/save)
 * - Inference flow with spend trace
 * - Config-not-found error handling
 * - Model override via explicit input
 * - Finance/runtime trail recording with shared identifiers
 *
 * Fulfills: VAL-BANKR-001
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TEST_BANKR_PROXY_URL } from "@/test/test-env";
import type { BankrResponse } from "@/lib/bankr/types";

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

const MOCK_BANKR_RESPONSE: BankrResponse = {
  id: "chatcmpl-bankr-flow-1",
  model: "claude-3-sonnet",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Bankr inference response" },
      finish_reason: "stop",
    },
  ],
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  created: 1700000000,
};

// ---------------------------------------------------------------------------
// Bankr Config — load/save
// ---------------------------------------------------------------------------

describe("Bankr config persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loadBankrConfig returns enabled + defaultModel from integrations table", async () => {
    const { loadBankrConfig } = await import("@/lib/bankr/config");

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { default_model: "claude-3-opus" },
          },
          error: null,
        });
      }
      return chain;
    });

    const config = await loadBankrConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.defaultModel).toBe("claude-3-opus");
    expect(config.configured).toBe(true);
  });

  it("loadBankrConfig returns disconnected when no row exists", async () => {
    const { loadBankrConfig } = await import("@/lib/bankr/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain;
    });

    const config = await loadBankrConfig("company-1");

    expect(config.enabled).toBe(false);
    expect(config.defaultModel).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("loadBankrConfig returns not-configured when enabled but no model", async () => {
    const { loadBankrConfig } = await import("@/lib/bankr/config");

    fromMock.mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { enabled: true, config: {} },
        error: null,
      });
      return chain;
    });

    const config = await loadBankrConfig("company-1");

    expect(config.enabled).toBe(true);
    expect(config.defaultModel).toBeNull();
    expect(config.configured).toBe(false);
  });

  it("saveBankrConfig inserts a new row when none exists", async () => {
    const { saveBankrConfig } = await import("@/lib/bankr/config");

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

    await saveBankrConfig("company-1", "gpt-4o");

    expect(fromMock).toHaveBeenCalledWith("integrations");
  });

  it("saveBankrConfig updates an existing row", async () => {
    const { saveBankrConfig } = await import("@/lib/bankr/config");

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

    await saveBankrConfig("company-1", "claude-3-opus");

    expect(updateCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bankr Inference Flow
// ---------------------------------------------------------------------------

describe("executeBankrInference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when Bankr is not configured and no model override given", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

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

    const result = await executeBankrInference({
      companyId: "company-1",
      agentId: "agent-1",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("executes a successful inference and records spend evidence", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { default_model: "claude-3-sonnet" },
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

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_BANKR_RESPONSE),
    });

    const result = await executeBankrInference({
      companyId: "company-1",
      agentId: "agent-1",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.success).toBe(true);
    expect(result.model).toBe("claude-3-sonnet");
    expect(result.response).not.toBeNull();
    expect(result.usage).not.toBeNull();
    expect(result.usage?.totalTokens).toBe(150);
    expect(result.estimatedCostCusd).not.toBeNull();
    expect(parseFloat(result.estimatedCostCusd!)).toBeGreaterThan(0);
  });

  it("records spend evidence with model, tokens, and cost in execution logs", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { default_model: "gpt-4o" },
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
          data: { id: "log-spend-1" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_BANKR_RESPONSE),
    });

    await executeBankrInference({
      companyId: "company-1",
      agentId: "agent-1",
      messages: [{ role: "user", content: "Test" }],
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    const content = entry.content as Record<string, unknown>;

    expect(content.action).toBe("bankr_inference");
    expect(content.integration).toBe("bankr");
    expect(content.model).toBe("gpt-4o");
    expect(content.usage).toBeDefined();

    const usage = content.usage as Record<string, number>;
    expect(usage.total_tokens).toBe(150);
    expect(usage.prompt_tokens).toBe(100);
    expect(usage.completion_tokens).toBe(50);

    expect(content.estimatedCostCusd).toBeDefined();
    expect(content.responseId).toBe("chatcmpl-bankr-flow-1");
  });

  it("uses explicit model override instead of config", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

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

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_BANKR_RESPONSE),
    });

    const result = await executeBankrInference({
      companyId: "company-1",
      agentId: "agent-1",
      messages: [{ role: "user", content: "Hello" }],
      model: "llama-3.3-70b",
    });

    expect(result.success).toBe(true);
    expect(result.model).toBe("llama-3.3-70b");
  });

  it("handles inference failure gracefully and records failure evidence", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { default_model: "gpt-4o" },
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
          data: { id: "log-fail" },
          error: null,
        });
      }
      if (table === "activity_events") {
        chain.insert = vi.fn(() => chain);
      }
      return chain;
    });

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const result = await executeBankrInference({
      companyId: "company-1",
      agentId: "agent-1",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Bankr inference failed");
    expect(result.model).toBe("gpt-4o");

    // Verify failure evidence was recorded
    const failEvidence = logInsertCalls.find((log) => {
      const c = log.content as Record<string, unknown>;
      return c.action === "bankr_inference_failed";
    });
    expect(failEvidence).toBeDefined();
  });

  it("records evidence with shared identifiers (company, agent, run)", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

    const logInsertCalls: Record<string, unknown>[] = [];

    fromMock.mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "integrations") {
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            enabled: true,
            config: { default_model: "claude-3-haiku" },
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

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_BANKR_RESPONSE),
    });

    await executeBankrInference({
      companyId: "company-abc",
      agentId: "agent-xyz",
      runId: "run-123",
      messages: [{ role: "user", content: "Hello" }],
    });

    expect(logInsertCalls.length).toBeGreaterThan(0);
    const entry = logInsertCalls[0];
    expect(entry.agent_id).toBe("agent-xyz");
    expect(entry.company_id).toBe("company-abc");
    expect(entry.run_id).toBe("run-123");
  });

  it("passes temperature and maxTokens options to the gateway", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

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

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_BANKR_RESPONSE),
    });

    await executeBankrInference({
      companyId: "company-1",
      model: "gpt-4o",
      messages: [{ role: "user", content: "Test" }],
      temperature: 0.7,
      maxTokens: 500,
    });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(500);
  });

  it("sends inference request to the Bankr proxy endpoint", async () => {
    const { executeBankrInference } = await import("@/lib/bankr/inference-flow");

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

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_BANKR_RESPONSE),
    });

    await executeBankrInference({
      companyId: "company-1",
      model: "claude-3-opus",
      messages: [{ role: "user", content: "Hello" }],
    });

    const [url] = fetchSpy.mock.calls[0];
    expect(url).toBe(TEST_BANKR_PROXY_URL);
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("Bankr barrel re-exports inference flow", () => {
  it("exports executeBankrInference from barrel", async () => {
    const mod = await import("@/lib/bankr/index");
    expect(mod.executeBankrInference).toBeDefined();
    expect(typeof mod.executeBankrInference).toBe("function");
  });

  it("exports loadBankrConfig from barrel", async () => {
    const mod = await import("@/lib/bankr/index");
    expect(mod.loadBankrConfig).toBeDefined();
    expect(typeof mod.loadBankrConfig).toBe("function");
  });

  it("exports saveBankrConfig from barrel", async () => {
    const mod = await import("@/lib/bankr/index");
    expect(mod.saveBankrConfig).toBeDefined();
    expect(typeof mod.saveBankrConfig).toBe("function");
  });
});
