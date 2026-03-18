import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

/* ---------- Supabase mock ---------- */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const methods = ["select", "insert", "update", "eq", "single", "maybeSingle", "order"];

      for (const method of methods) {
        chain[method] = vi.fn(() => chain);
      }

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

/* ================================================================
   Wallet Validation
   ================================================================ */

describe("isPlaceholderWallet", () => {
  it("identifies 0x0 as a placeholder", async () => {
    const { isPlaceholderWallet } = await import("@/lib/erc8004/identity");
    expect(isPlaceholderWallet("0x0")).toBe(true);
  });

  it("identifies empty string as a placeholder", async () => {
    const { isPlaceholderWallet } = await import("@/lib/erc8004/identity");
    expect(isPlaceholderWallet("")).toBe(true);
  });

  it("identifies null/undefined as a placeholder", async () => {
    const { isPlaceholderWallet } = await import("@/lib/erc8004/identity");
    expect(isPlaceholderWallet(null as unknown as string)).toBe(true);
    expect(isPlaceholderWallet(undefined as unknown as string)).toBe(true);
  });

  it("identifies 0x000...000 zero-address as a placeholder", async () => {
    const { isPlaceholderWallet } = await import("@/lib/erc8004/identity");
    expect(isPlaceholderWallet("0x0000000000000000000000000000000000000000")).toBe(true);
  });

  it("recognizes a valid wallet address as non-placeholder", async () => {
    const { isPlaceholderWallet } = await import("@/lib/erc8004/identity");
    expect(isPlaceholderWallet("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
  });

  it("recognizes a checksummed wallet address as non-placeholder", async () => {
    const { isPlaceholderWallet } = await import("@/lib/erc8004/identity");
    expect(isPlaceholderWallet("0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B")).toBe(false);
  });
});

/* ================================================================
   createAgentIdentity — wallet validation
   ================================================================ */

describe("createAgentIdentity rejects placeholder wallets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when operatorWallet is 0x0", async () => {
    const { createAgentIdentity } = await import("@/lib/erc8004/identity");

    await expect(
      createAgentIdentity("agent-1", "company-1", "0x0"),
    ).rejects.toThrow(/placeholder/i);
  });

  it("throws when operatorWallet is empty string", async () => {
    const { createAgentIdentity } = await import("@/lib/erc8004/identity");

    await expect(
      createAgentIdentity("agent-1", "company-1", ""),
    ).rejects.toThrow(/placeholder/i);
  });

  it("throws when operatorWallet is the zero address", async () => {
    const { createAgentIdentity } = await import("@/lib/erc8004/identity");

    await expect(
      createAgentIdentity("agent-1", "company-1", "0x0000000000000000000000000000000000000000"),
    ).rejects.toThrow(/placeholder/i);
  });
});

/* ================================================================
   AgentIdentitySection — display completeness
   ================================================================ */

describe("AgentIdentitySection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state with spinner", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    // Mock: query that never resolves (stays loading)
    vi.mocked(supabase.from).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockReturnValue(new Promise(() => {}));
      return chain as ReturnType<typeof supabase.from>;
    });

    const { AgentIdentitySection } = await import("@/components/AgentIdentitySection");
    const queryClient = createTestQueryClient();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AgentIdentitySection, { agentId: "agent-123" }),
      ),
    );

    expect(screen.getByText("ERC-8004 Identity")).toBeTruthy();
  });

  it("renders empty state when no identity exists", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain as ReturnType<typeof supabase.from>;
    });

    const { AgentIdentitySection } = await import("@/components/AgentIdentitySection");
    const queryClient = createTestQueryClient();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AgentIdentitySection, { agentId: "agent-123" }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("No identity registered yet.")).toBeTruthy();
    });
  });

  it("renders identity with registration status, operator wallet, and manifest", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    const mockIdentity = {
      id: "id-1",
      agent_id: "agent-1",
      company_id: "comp-1",
      operator_wallet: "0x1234567890abcdef1234567890abcdef12345678",
      manifest: {
        name: "Test Agent",
        operator_wallet: "0x1234567890abcdef1234567890abcdef12345678",
        erc8004_identity: "erc8004:agent-1",
        supported_tools: ["code_generation"],
        tech_stacks: ["typescript"],
        compute_constraints: {
          max_iterations: 100,
          max_tokens_per_run: 200000,
          budget_usd: 10,
        },
        task_categories: ["general"],
      },
      registered_on_chain: false,
      chain_tx_hash: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockIdentity, error: null });
      return chain as ReturnType<typeof supabase.from>;
    });

    const { AgentIdentitySection } = await import("@/components/AgentIdentitySection");
    const queryClient = createTestQueryClient();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AgentIdentitySection, { agentId: "agent-1" }),
      ),
    );

    await waitFor(() => {
      // Registration Status label is present
      expect(screen.getByText("Registration Status")).toBeTruthy();
      // Operator Wallet label is present
      expect(screen.getByText("Operator Wallet")).toBeTruthy();
      // Agent Manifest label is present
      expect(screen.getByText("Agent Manifest")).toBeTruthy();
      // Shows Pending badge when not registered on chain
      expect(screen.getByText("Pending")).toBeTruthy();
      // Wallet truncated display: 0x1234...5678
      expect(screen.getByText("0x1234…5678")).toBeTruthy();
    });
  });

  it("renders Registered badge when registered_on_chain is true", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    const mockIdentity = {
      id: "id-1",
      agent_id: "agent-1",
      company_id: "comp-1",
      operator_wallet: "0x1234567890abcdef1234567890abcdef12345678",
      manifest: {
        name: "Test Agent",
        operator_wallet: "0x1234567890abcdef1234567890abcdef12345678",
        erc8004_identity: "erc8004:agent-1",
        supported_tools: ["code_generation"],
        tech_stacks: ["typescript"],
        compute_constraints: { max_iterations: 100, max_tokens_per_run: 200000, budget_usd: 10 },
        task_categories: ["general"],
      },
      registered_on_chain: true,
      chain_tx_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockIdentity, error: null });
      return chain as ReturnType<typeof supabase.from>;
    });

    const { AgentIdentitySection } = await import("@/components/AgentIdentitySection");
    const queryClient = createTestQueryClient();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AgentIdentitySection, { agentId: "agent-1" }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("Registered")).toBeTruthy();
      // TX Hash section visible
      expect(screen.getByText("TX Hash")).toBeTruthy();
    });
  });

  it("renders manifest JSON with erc8004_identity field", async () => {
    const { supabase } = await import("@/integrations/supabase/client");

    const mockIdentity = {
      id: "id-1",
      agent_id: "agent-1",
      company_id: "comp-1",
      operator_wallet: "0x1234567890abcdef1234567890abcdef12345678",
      manifest: {
        name: "Test Agent",
        operator_wallet: "0x1234567890abcdef1234567890abcdef12345678",
        erc8004_identity: "erc8004:agent-1",
        supported_tools: ["code_generation"],
        tech_stacks: ["typescript"],
        compute_constraints: { max_iterations: 100, max_tokens_per_run: 200000, budget_usd: 10 },
        task_categories: ["general"],
      },
      registered_on_chain: false,
      chain_tx_hash: null,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockIdentity, error: null });
      return chain as ReturnType<typeof supabase.from>;
    });

    const { AgentIdentitySection } = await import("@/components/AgentIdentitySection");
    const queryClient = createTestQueryClient();

    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(AgentIdentitySection, { agentId: "agent-1" }),
      ),
    );

    await waitFor(() => {
      // The manifest JSON should contain the erc8004_identity string
      const preElement = document.querySelector("pre");
      expect(preElement?.textContent).toContain("erc8004:agent-1");
      expect(preElement?.textContent).toContain("Test Agent");
      expect(preElement?.textContent).toContain("code_generation");
    });
  });
});
