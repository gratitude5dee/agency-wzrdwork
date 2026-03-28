import { describe, it, expect } from "vitest";
import { adapterRegistry, getUIAdapter } from "@/adapters/registry";
import { parseHermesStdoutLine } from "@/adapters/hermes/parse-stdout";
import {
  buildHermesConfig,
  getHermesExtras,
  HERMES_DEFAULT_MODEL,
  HERMES_MODELS,
  HERMES_PROVIDERS,
  HERMES_TOOLSETS,
  HERMES_MEMORY_MODES,
} from "@/adapters/hermes/build-config";
import type { CreateConfigValues } from "@/adapters/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultValues(overrides?: Partial<CreateConfigValues>): CreateConfigValues {
  return {
    adapterType: "hermes",
    cwd: "/tmp/test",
    promptTemplate: "",
    model: "",
    thinkingEffort: "medium",
    chrome: false,
    dangerouslySkipPermissions: false,
    search: false,
    dangerouslyBypassSandbox: false,
    command: "",
    args: "",
    extraArgs: "",
    envVars: "",
    envBindings: {},
    url: "",
    bootstrapPrompt: "",
    maxTurnsPerRun: 90,
    heartbeatEnabled: false,
    intervalSec: 60,
    ...overrides,
  };
}

function makeValuesWithExtras(extras: Record<string, unknown>): CreateConfigValues {
  return makeDefaultValues({
    envBindings: { __hermes_extras__: extras },
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

describe("Hermes Adapter Registration", () => {
  it("is registered in the adapter registry", () => {
    expect(adapterRegistry.has("hermes")).toBe(true);
  });

  it("registry.get returns valid UIAdapterModule", () => {
    const adapter = adapterRegistry.get("hermes");
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe("hermes");
    expect(adapter!.label).toBe("Hermes Agent");
  });

  it("getUIAdapter returns the hermes adapter", () => {
    const adapter = getUIAdapter("hermes");
    expect(adapter.type).toBe("hermes");
    expect(adapter.label).toBe("Hermes Agent");
  });

  it("has all required interface methods", () => {
    const adapter = getUIAdapter("hermes");
    expect(typeof adapter.parseStdoutLine).toBe("function");
    expect(typeof adapter.ConfigFields).toBe("function");
    expect(typeof adapter.buildAdapterConfig).toBe("function");
  });

  it("adapter registry now contains 10 adapters", () => {
    expect(adapterRegistry.size).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// buildAdapterConfig
// ---------------------------------------------------------------------------

describe("buildHermesConfig", () => {
  it("produces valid JSON with all required fields", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(config).toHaveProperty("hermes_home");
    expect(config).toHaveProperty("model");
    expect(config).toHaveProperty("provider");
    expect(config).toHaveProperty("enabled_toolsets");
    expect(config).toHaveProperty("memory_mode");
    expect(config).toHaveProperty("mcp_servers");
  });

  it("uses default model when no extras provided", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(config.model).toBe(HERMES_DEFAULT_MODEL);
  });

  it("uses provided model from extras", () => {
    const values = makeValuesWithExtras({ hermesModel: "openai/gpt-4o" });
    const config = buildHermesConfig(values);
    expect(config.model).toBe("openai/gpt-4o");
  });

  it("uses default provider when none set", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(config.provider).toBe("auto");
  });

  it("uses specified provider from extras", () => {
    const values = makeValuesWithExtras({ hermesProvider: "anthropic" });
    const config = buildHermesConfig(values);
    expect(config.provider).toBe("anthropic");
  });

  it("includes default toolsets", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(Array.isArray(config.enabled_toolsets)).toBe(true);
    const toolsets = config.enabled_toolsets as string[];
    expect(toolsets).toContain("web");
    expect(toolsets).toContain("terminal");
    expect(toolsets).toContain("file");
    expect(toolsets).toContain("code");
  });

  it("includes custom toolsets from extras", () => {
    const values = makeValuesWithExtras({
      enabledToolsets: ["browser", "research", "delegate"],
    });
    const config = buildHermesConfig(values);
    const toolsets = config.enabled_toolsets as string[];
    expect(toolsets).toEqual(["browser", "research", "delegate"]);
  });

  it("sets memory_mode to local by default", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(config.memory_mode).toBe("local");
  });

  it("uses honcho memory mode when specified", () => {
    const values = makeValuesWithExtras({ memoryMode: "honcho" });
    const config = buildHermesConfig(values);
    expect(config.memory_mode).toBe("honcho");
  });

  it("includes mcp_servers as empty array by default", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(Array.isArray(config.mcp_servers)).toBe(true);
    expect(config.mcp_servers).toEqual([]);
  });

  it("includes configured MCP servers", () => {
    const values = makeValuesWithExtras({
      mcpServers: [
        { name: "code-search", url: "https://mcp.example.com/search" },
        { name: "db-query", url: "https://mcp.example.com/db" },
      ],
    });
    const config = buildHermesConfig(values);
    const servers = config.mcp_servers as { name: string; url: string }[];
    expect(servers).toHaveLength(2);
    expect(servers[0].name).toBe("code-search");
    expect(servers[1].url).toBe("https://mcp.example.com/db");
  });

  it("filters out MCP servers with empty name or url", () => {
    const values = makeValuesWithExtras({
      mcpServers: [
        { name: "valid", url: "https://mcp.example.com" },
        { name: "", url: "https://empty-name.com" },
        { name: "empty-url", url: "" },
      ],
    });
    const config = buildHermesConfig(values);
    const servers = config.mcp_servers as { name: string; url: string }[];
    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe("valid");
  });

  it("sets hermes_home to ~/.hermes", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(config.hermes_home).toBe("~/.hermes");
  });

  it("uses maxTurnsPerRun for max_turns", () => {
    const values = makeDefaultValues({ maxTurnsPerRun: 50 });
    const config = buildHermesConfig(values);
    expect(config.max_turns).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// getHermesExtras
// ---------------------------------------------------------------------------

describe("getHermesExtras", () => {
  it("returns defaults when envBindings has no hermes extras", () => {
    const extras = getHermesExtras(makeDefaultValues());
    expect(extras.hermesModel).toBe(HERMES_DEFAULT_MODEL);
    expect(extras.hermesProvider).toBe("auto");
    expect(extras.enabledToolsets).toEqual(["web", "terminal", "file", "code"]);
    expect(extras.memoryMode).toBe("local");
    expect(extras.mcpServers).toEqual([]);
  });

  it("reads stored extras from envBindings", () => {
    const values = makeValuesWithExtras({
      hermesModel: "google/gemini-2.5-pro",
      hermesProvider: "openrouter",
      enabledToolsets: ["web", "browser"],
      memoryMode: "hybrid",
      mcpServers: [{ name: "test", url: "https://test.com" }],
    });
    const extras = getHermesExtras(values);
    expect(extras.hermesModel).toBe("google/gemini-2.5-pro");
    expect(extras.hermesProvider).toBe("openrouter");
    expect(extras.enabledToolsets).toEqual(["web", "browser"]);
    expect(extras.memoryMode).toBe("hybrid");
    expect(extras.mcpServers).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("Hermes Constants", () => {
  it("has model options list", () => {
    expect(HERMES_MODELS.length).toBeGreaterThan(0);
    for (const m of HERMES_MODELS) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });

  it("includes the default model in the model options", () => {
    const ids = HERMES_MODELS.map((m) => m.id);
    expect(ids).toContain(HERMES_DEFAULT_MODEL);
  });

  it("has provider options", () => {
    expect(HERMES_PROVIDERS.length).toBe(4);
    const values = HERMES_PROVIDERS.map((p) => p.value);
    expect(values).toContain("openrouter");
    expect(values).toContain("anthropic");
    expect(values).toContain("openai");
    expect(values).toContain("auto");
  });

  it("has 7 toolset options", () => {
    expect(HERMES_TOOLSETS.length).toBe(7);
    const values = HERMES_TOOLSETS.map((t) => t.value);
    expect(values).toContain("web");
    expect(values).toContain("terminal");
    expect(values).toContain("file");
    expect(values).toContain("browser");
    expect(values).toContain("research");
    expect(values).toContain("code");
    expect(values).toContain("delegate");
  });

  it("has 3 memory modes", () => {
    expect(HERMES_MEMORY_MODES.length).toBe(3);
    const values = HERMES_MEMORY_MODES.map((m) => m.value);
    expect(values).toContain("local");
    expect(values).toContain("honcho");
    expect(values).toContain("hybrid");
  });
});

// ---------------------------------------------------------------------------
// parseStdoutLine
// ---------------------------------------------------------------------------

describe("parseHermesStdoutLine", () => {
  const ts = "2025-01-01T00:00:00Z";

  it("returns assistant entry for plain text", () => {
    const entries = parseHermesStdoutLine("Hello from Hermes", ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("assistant");
    if (entries[0].kind === "assistant") {
      expect(entries[0].text).toBe("Hello from Hermes");
    }
  });

  it("returns empty array for blank lines", () => {
    expect(parseHermesStdoutLine("", ts)).toEqual([]);
    expect(parseHermesStdoutLine("   ", ts)).toEqual([]);
  });

  it("parses JSON tool_call event", () => {
    const line = JSON.stringify({
      type: "tool_call",
      name: "web_search",
      args: { query: "test" },
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("tool_call");
    if (entries[0].kind === "tool_call") {
      expect(entries[0].name).toBe("web_search");
      expect(entries[0].input).toEqual({ query: "test" });
    }
  });

  it("parses tool_progress event as tool_call", () => {
    const line = JSON.stringify({
      type: "tool_progress",
      name: "execute",
      preview: "Running command...",
      args: { command: "ls -la" },
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("tool_call");
    if (entries[0].kind === "tool_call") {
      expect(entries[0].name).toBe("execute");
    }
  });

  it("parses tool_result event", () => {
    const line = JSON.stringify({
      type: "tool_result",
      tool_use_id: "tc-123",
      content: "Operation completed",
      is_error: false,
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("tool_result");
    if (entries[0].kind === "tool_result") {
      expect(entries[0].toolUseId).toBe("tc-123");
      expect(entries[0].content).toBe("Operation completed");
      expect(entries[0].isError).toBe(false);
    }
  });

  it("parses tool_result with error flag", () => {
    const line = JSON.stringify({
      type: "tool_result",
      tool_use_id: "tc-err",
      content: "Command failed",
      is_error: true,
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    if (entries[0].kind === "tool_result") {
      expect(entries[0].isError).toBe(true);
    }
  });

  it("parses thinking block", () => {
    const line = JSON.stringify({
      type: "thinking",
      text: "Let me analyze this...",
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("thinking");
    if (entries[0].kind === "thinking") {
      expect(entries[0].text).toBe("Let me analyze this...");
    }
  });

  it("parses thought alias as thinking", () => {
    const line = JSON.stringify({
      type: "thought",
      text: "Considering options...",
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("thinking");
  });

  it("parses agent_message as assistant", () => {
    const line = JSON.stringify({
      type: "agent_message",
      text: "Here is the result.",
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("assistant");
    if (entries[0].kind === "assistant") {
      expect(entries[0].text).toBe("Here is the result.");
    }
  });

  it("parses message alias as assistant", () => {
    const line = JSON.stringify({
      type: "message",
      text: "Done.",
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("assistant");
  });

  it("parses step event as system", () => {
    const line = JSON.stringify({
      type: "step",
      api_call_count: 5,
      prev_tools: ["web_search"],
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("system");
    if (entries[0].kind === "system") {
      expect(entries[0].text).toContain("5");
    }
  });

  it("parses error event as stderr", () => {
    const line = JSON.stringify({
      type: "error",
      message: "Rate limit exceeded",
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("stderr");
    if (entries[0].kind === "stderr") {
      expect(entries[0].text).toBe("Rate limit exceeded");
    }
  });

  it("handles unknown JSON as stdout", () => {
    const line = JSON.stringify({ type: "custom_event", data: 42 });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("stdout");
  });

  it("handles empty thinking text gracefully", () => {
    const line = JSON.stringify({ type: "thinking", text: "" });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toEqual([]);
  });

  it("handles tool_call with tool_call_id", () => {
    const line = JSON.stringify({
      type: "tool_call",
      name: "file_write",
      tool_call_id: "tc-456",
      args: { path: "/test.txt" },
    });
    const entries = parseHermesStdoutLine(line, ts);
    expect(entries).toHaveLength(1);
    if (entries[0].kind === "tool_call") {
      expect(entries[0].toolUseId).toBe("tc-456");
    }
  });
});
