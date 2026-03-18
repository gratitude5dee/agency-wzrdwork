import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

/* ---------- Supabase mock ---------- */

let mockFromChain: Record<string, unknown>;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      // Return a chainable mock with all possible methods
      const chain: Record<string, unknown> = {};
      const methods = ["select", "insert", "update", "eq", "single", "maybeSingle", "order"];

      for (const method of methods) {
        chain[method] = vi.fn(() => chain);
      }

      // Store the chain so tests can override return values
      mockFromChain = chain;
      return chain;
    }),
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
   Types
   ================================================================ */

describe("ERC-8004 Types", () => {
  it("AgentManifest type includes all required fields", async () => {
    // Verify the type module exports correctly by creating a valid manifest object
    const manifest: import("@/lib/erc8004/types").AgentManifest = {
      name: "Test Agent",
      operator_wallet: "0x1234567890abcdef1234567890abcdef12345678",
      erc8004_identity: "erc8004:test-id",
      supported_tools: ["code_generation"],
      tech_stacks: ["typescript"],
      compute_constraints: {
        max_iterations: 100,
        max_tokens_per_run: 200000,
        budget_usd: 10,
      },
      task_categories: ["general"],
    };

    expect(manifest.name).toBe("Test Agent");
    expect(manifest.operator_wallet).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(manifest.erc8004_identity).toBe("erc8004:test-id");
    expect(manifest.supported_tools).toEqual(["code_generation"]);
    expect(manifest.tech_stacks).toEqual(["typescript"]);
    expect(manifest.compute_constraints).toEqual({
      max_iterations: 100,
      max_tokens_per_run: 200000,
      budget_usd: 10,
    });
    expect(manifest.task_categories).toEqual(["general"]);
  });

  it("ExecutionLogEntry type includes all required fields", async () => {
    const entry: import("@/lib/erc8004/types").ExecutionLogEntry = {
      id: "entry-1",
      company_id: "company-1",
      agent_id: "agent-1",
      run_id: "run-1",
      log_type: "decision",
      content: { message: "test" },
      created_at: new Date().toISOString(),
    };

    expect(entry.id).toBe("entry-1");
    expect(entry.log_type).toBe("decision");
    expect(entry.content).toEqual({ message: "test" });
  });

  it("ExecutionLogType supports all 6 log types", () => {
    const validTypes: import("@/lib/erc8004/types").ExecutionLogType[] = [
      "decision",
      "tool_call",
      "retry",
      "failure",
      "output",
      "safety_check",
    ];
    expect(validTypes).toHaveLength(6);
  });
});

/* ================================================================
   Manifest Builder
   ================================================================ */

describe("buildManifest", () => {
  it("generates valid manifest with name, operator_wallet, supported_tools, tech_stacks, compute_constraints, task_categories", async () => {
    const { buildManifest } = await import("@/lib/erc8004/manifest");

    const agent = {
      id: "agent-123",
      name: "Lead Engineer",
      role: "engineer",
      adapter_type: "claude_local",
    };

    const manifest = buildManifest(agent, "0xWALLET");

    expect(manifest.name).toBe("Lead Engineer");
    expect(manifest.operator_wallet).toBe("0xWALLET");
    expect(manifest.erc8004_identity).toBe("erc8004:agent-123");
    expect(manifest.supported_tools).toEqual([
      "code_generation",
      "code_review",
      "file_editing",
      "terminal",
    ]);
    expect(manifest.tech_stacks).toEqual(["typescript", "react", "supabase", "vite"]);
    expect(manifest.compute_constraints).toEqual({
      max_iterations: 100,
      max_tokens_per_run: 200_000,
      budget_usd: 10,
    });
    expect(manifest.task_categories).toEqual([
      "code_generation",
      "debugging",
      "code_review",
      "testing",
    ]);
  });

  it("uses default tools for unknown adapter type", async () => {
    const { buildManifest } = await import("@/lib/erc8004/manifest");

    const manifest = buildManifest(
      { id: "a1", name: "Test", role: "engineer", adapter_type: "unknown_adapter" },
      "0x123",
    );

    expect(manifest.supported_tools).toEqual(["general"]);
  });

  it("uses default categories for unknown role", async () => {
    const { buildManifest } = await import("@/lib/erc8004/manifest");

    const manifest = buildManifest(
      { id: "a1", name: "Test", role: "unknown_role", adapter_type: "claude_local" },
      "0x123",
    );

    expect(manifest.task_categories).toEqual(["general"]);
  });

  it("maps each adapter type to specific tools", async () => {
    const { buildManifest } = await import("@/lib/erc8004/manifest");

    const adapters = [
      "claude_local",
      "codex_local",
      "cursor",
      "gemini_local",
      "opencode_local",
      "pi_local",
      "openclaw_gateway",
      "process",
      "http",
      "hermes",
    ];

    for (const adapter of adapters) {
      const manifest = buildManifest(
        { id: "a1", name: "Test", role: "engineer", adapter_type: adapter },
        "0x123",
      );
      expect(manifest.supported_tools.length).toBeGreaterThan(0);
      expect(manifest.supported_tools).not.toEqual(["general"]);
    }
  });

  it("maps each role to specific categories", async () => {
    const { buildManifest } = await import("@/lib/erc8004/manifest");

    const roles = [
      "ceo",
      "cto",
      "coo",
      "manager",
      "engineer",
      "founding_engineer",
      "analyst",
      "designer",
      "researcher",
      "ops",
      "support",
      "custom",
    ];

    for (const role of roles) {
      const manifest = buildManifest(
        { id: "a1", name: "Test", role, adapter_type: "claude_local" },
        "0x123",
      );
      expect(manifest.task_categories.length).toBeGreaterThan(0);
    }
  });
});

/* ================================================================
   useAgentIdentity Hook
   ================================================================ */

describe("useAgentIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when agentId is undefined", async () => {
    const { useAgentIdentity } = await import("@/hooks/useAgentIdentity");

    const { result } = renderHook(() => useAgentIdentity(undefined), { wrapper });

    // Query should not be enabled, so data remains undefined
    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it("queries agent_identities table by agent_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { useAgentIdentity } = await import("@/hooks/useAgentIdentity");

    // Setup mock to return data
    const mockIdentity = {
      id: "id-1",
      agent_id: "agent-1",
      company_id: "comp-1",
      operator_wallet: "0xWALLET",
      manifest: { name: "Test" },
      registered_on_chain: false,
      chain_tx_hash: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };

    // Override the maybeSingle to return our mock
    vi.mocked(supabase.from).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockIdentity, error: null });
      return chain as ReturnType<typeof supabase.from>;
    });

    const { result } = renderHook(() => useAgentIdentity("agent-1"), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockIdentity);
    });
  });
});

/* ================================================================
   Index re-exports
   ================================================================ */

describe("ERC-8004 index exports", () => {
  it("exports buildManifest function", async () => {
    const mod = await import("@/lib/erc8004/index");
    expect(typeof mod.buildManifest).toBe("function");
  });

  it("exports createAgentIdentity function", async () => {
    const mod = await import("@/lib/erc8004/index");
    expect(typeof mod.createAgentIdentity).toBe("function");
  });

  it("exports isPlaceholderWallet function", async () => {
    const mod = await import("@/lib/erc8004/index");
    expect(typeof mod.isPlaceholderWallet).toBe("function");
  });
});
