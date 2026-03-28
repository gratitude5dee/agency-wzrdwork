import { describe, expect, it, vi, beforeEach } from "vitest";

/* ---------- Supabase mock ---------- */

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockRange = vi.fn();

function buildChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  chain.single = mockSingle;
  chain.maybeSingle = mockMaybeSingle;
  chain.limit = mockLimit.mockReturnValue(chain);
  chain.range = mockRange.mockReturnValue(chain);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => buildChain()),
  },
}));

/* ================================================================
   downloadAgentManifest — builds retrievable agent.json from identity
   ================================================================ */

describe("downloadAgentManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a well-formed agent.json object with required fields", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getAgentManifestJson } = await import("@/lib/erc8004/download");

    const mockIdentity = {
      id: "identity-1",
      agent_id: "agent-1",
      company_id: "company-1",
      operator_wallet: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
      manifest: {
        name: "CEO Agent",
        operator_wallet: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12",
        erc8004_identity: "erc8004:agent-1",
        supported_tools: ["code_generation"],
        tech_stacks: ["typescript"],
        compute_constraints: { max_iterations: 100, max_tokens_per_run: 200000, budget_usd: 10 },
        task_categories: ["strategy"],
      },
      registered_on_chain: false,
      chain_tx_hash: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockIdentity, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getAgentManifestJson("agent-1");

    // Must contain required Protocol Labs agent.json fields
    expect(result).toHaveProperty("name", "CEO Agent");
    expect(result).toHaveProperty("operator_wallet");
    expect(result).toHaveProperty("erc8004_identity", "erc8004:agent-1");
    expect(result).toHaveProperty("supported_tools");
    expect(result).toHaveProperty("tech_stacks");
    expect(result).toHaveProperty("compute_constraints");
    expect(result).toHaveProperty("task_categories");
    // Must contain identity metadata
    expect(result).toHaveProperty("agent_id", "agent-1");
    expect(result).toHaveProperty("company_id", "company-1");
    expect(result).toHaveProperty("registered_on_chain", false);
  });

  it("agent_id in output matches the queried agent", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getAgentManifestJson } = await import("@/lib/erc8004/download");

    const mockIdentity = {
      id: "identity-2",
      agent_id: "agent-99",
      company_id: "company-2",
      operator_wallet: "0x1111111111111111111111111111111111111111",
      manifest: {
        name: "Worker Bot",
        operator_wallet: "0x1111111111111111111111111111111111111111",
        erc8004_identity: "erc8004:agent-99",
        supported_tools: ["terminal"],
        tech_stacks: ["typescript"],
        compute_constraints: { max_iterations: 50, max_tokens_per_run: 100000, budget_usd: 5 },
        task_categories: ["code_generation"],
      },
      registered_on_chain: true,
      chain_tx_hash: "0xTX123",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockIdentity, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getAgentManifestJson("agent-99");

    expect(result.agent_id).toBe("agent-99");
    expect(result.company_id).toBe("company-2");
    expect(result.registered_on_chain).toBe(true);
    expect(result.chain_tx_hash).toBe("0xTX123");
  });

  it("throws when no identity exists for the agent", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getAgentManifestJson } = await import("@/lib/erc8004/download");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(getAgentManifestJson("no-agent")).rejects.toThrow(
      "No ERC-8004 identity found",
    );
  });

  it("throws when manifest is null in identity row", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getAgentManifestJson } = await import("@/lib/erc8004/download");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: {
          id: "identity-bad",
          agent_id: "agent-bad",
          company_id: "company-1",
          operator_wallet: "0x1234",
          manifest: null,
          registered_on_chain: false,
          chain_tx_hash: null,
        },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(getAgentManifestJson("agent-bad")).rejects.toThrow(
      "No manifest data",
    );
  });
});

/* ================================================================
   getRunLogJson — builds run-scoped agent_log.json for download
   ================================================================ */

describe("getRunLogJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns run-scoped agent_log.json with all envelope fields", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getRunLogJson } = await import("@/lib/erc8004/download");

    const mockRun = {
      id: "run-1",
      agent_id: "agent-1",
      company_id: "company-1",
      status: "completed",
      created_at: "2025-01-01T00:00:00Z",
      finished_at: "2025-01-01T00:05:00Z",
      summary: "Done",
      total_input_tokens: 500,
      total_output_tokens: 200,
      total_cost_usd: 0.02,
    };

    const mockLogs = [
      {
        id: "log-1",
        agent_id: "agent-1",
        company_id: "company-1",
        run_id: "run-1",
        log_type: "decision",
        content: { message: "pick A" },
        created_at: "2025-01-01T00:01:00Z",
      },
    ];

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "runs") {
        chain.single = vi.fn().mockResolvedValue({ data: mockRun, error: null });
      } else if (table === "agent_execution_logs") {
        chain.order = vi.fn().mockResolvedValue({ data: mockLogs, error: null });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getRunLogJson("run-1");

    expect(result).toHaveProperty("run_id", "run-1");
    expect(result).toHaveProperty("agent_id", "agent-1");
    expect(result).toHaveProperty("company_id", "company-1");
    expect(result).toHaveProperty("status", "completed");
    expect(result).toHaveProperty("started_at");
    expect(result).toHaveProperty("finished_at");
    expect(result).toHaveProperty("usage");
    expect(result).toHaveProperty("entries");
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toHaveProperty("log_id", "log-1");
  });

  it("run_id in output matches the queried run", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getRunLogJson } = await import("@/lib/erc8004/download");

    const mockRun = {
      id: "run-42",
      agent_id: "agent-2",
      company_id: "company-2",
      status: "completed",
      created_at: "2025-02-01T00:00:00Z",
      finished_at: "2025-02-01T00:10:00Z",
      summary: "Full run",
      total_input_tokens: 1000,
      total_output_tokens: 400,
      total_cost_usd: 0.04,
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

    const result = await getRunLogJson("run-42");
    expect(result.run_id).toBe("run-42");
    expect(result.agent_id).toBe("agent-2");
  });
});

/* ================================================================
   triggerJsonDownload — creates downloadable blob
   ================================================================ */

describe("triggerJsonDownload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a link element and triggers a click for download", async () => {
    const { triggerJsonDownload } = await import("@/lib/erc8004/download");

    const createObjectURL = vi.fn().mockReturnValue("blob:test-url");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(global, "URL", {
      value: { createObjectURL, revokeObjectURL },
      writable: true,
    });

    const mockClick = vi.fn();
    const mockLink = {
      href: "",
      download: "",
      click: mockClick,
    };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLAnchorElement);

    triggerJsonDownload({ foo: "bar" }, "test-file.json");

    expect(createObjectURL).toHaveBeenCalled();
    expect(mockLink.download).toBe("test-file.json");
    expect(mockClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });
});

/* ================================================================
   Index re-exports
   ================================================================ */

describe("download module exports", () => {
  it("exports getAgentManifestJson", async () => {
    const mod = await import("@/lib/erc8004/download");
    expect(typeof mod.getAgentManifestJson).toBe("function");
  });

  it("exports getRunLogJson", async () => {
    const mod = await import("@/lib/erc8004/download");
    expect(typeof mod.getRunLogJson).toBe("function");
  });

  it("exports triggerJsonDownload", async () => {
    const mod = await import("@/lib/erc8004/download");
    expect(typeof mod.triggerJsonDownload).toBe("function");
  });
});
