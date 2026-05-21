import { describe, it, expect } from "vitest";
import { adapterRegistry, getUIAdapter } from "@/adapters/registry";
import type { UIAdapterModule, CreateConfigValues } from "@/adapters/types";

const EXPECTED_ADAPTER_TYPES = [
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
  "grok_local",
  "cursor_cloud",
  "acpx_local",
] as const;

const EXPECTED_LABELS: Record<string, string> = {
  claude_local: "Claude Code (local)",
  codex_local: "Codex (local)",
  cursor: "Cursor CLI (local)",
  gemini_local: "Gemini CLI (local)",
  opencode_local: "OpenCode (local)",
  pi_local: "Pi (local)",
  openclaw_gateway: "OpenClaw Gateway",
  process: "Shell Process",
  http: "HTTP Webhook",
  hermes: "Hermes Agent",
  grok_local: "Grok Build (local)",
  cursor_cloud: "Cursor Cloud",
  acpx_local: "ACPX (local)",
};

function makeDefaultValues(adapterType: string): CreateConfigValues {
  return {
    adapterType,
    cwd: "/tmp/test",
    promptTemplate: "test prompt",
    model: "test-model",
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
    adapterSchemaValues: {},
    url: "https://example.com",
    bootstrapPrompt: "",
    maxTurnsPerRun: 300,
    heartbeatEnabled: false,
    intervalSec: 60,
  };
}

describe("Adapter Registry", () => {
  it("contains exactly 13 adapters", () => {
    expect(adapterRegistry.size).toBe(13);
  });

  it("contains all expected adapter types", () => {
    for (const type of EXPECTED_ADAPTER_TYPES) {
      expect(adapterRegistry.has(type)).toBe(true);
    }
  });

  it("getUIAdapter returns the correct adapter for each type", () => {
    for (const type of EXPECTED_ADAPTER_TYPES) {
      const adapter = getUIAdapter(type);
      expect(adapter.type).toBe(type);
    }
  });

  it("getUIAdapter falls back to process for unknown types", () => {
    const adapter = getUIAdapter("unknown_adapter");
    expect(adapter.type).toBe("process");
    expect(adapter.label).toBe("Shell Process");
  });
});

describe("Adapter Module Interface", () => {
  for (const type of EXPECTED_ADAPTER_TYPES) {
    describe(type, () => {
      let adapter: UIAdapterModule;

      beforeAll(() => {
        adapter = getUIAdapter(type);
      });

      it("has correct type string", () => {
        expect(adapter.type).toBe(type);
      });

      it("has correct label", () => {
        expect(adapter.label).toBe(EXPECTED_LABELS[type]);
      });

      it("has parseStdoutLine function", () => {
        expect(typeof adapter.parseStdoutLine).toBe("function");
      });

      it("has ConfigFields component", () => {
        expect(adapter.ConfigFields).toBeDefined();
        // ConfigFields is a React component (function)
        expect(typeof adapter.ConfigFields).toBe("function");
      });

      it("has buildAdapterConfig function", () => {
        expect(typeof adapter.buildAdapterConfig).toBe("function");
      });

      it("parseStdoutLine returns TranscriptEntry array for plain text", () => {
        const result = adapter.parseStdoutLine("hello world", "2025-01-01T00:00:00Z");
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(0);
        for (const entry of result) {
          expect(entry).toHaveProperty("kind");
          expect(entry).toHaveProperty("ts");
        }
      });

      it("buildAdapterConfig returns a valid config object", () => {
        const values = makeDefaultValues(type);
        const config = adapter.buildAdapterConfig(values);
        expect(typeof config).toBe("object");
        expect(config).not.toBeNull();
        expect(Array.isArray(config)).toBe(false);
      });
    });
  }
});

describe("buildAdapterConfig specifics", () => {
  it("claude_local includes cwd, model, maxTurnsPerRun", () => {
    const adapter = getUIAdapter("claude_local");
    const config = adapter.buildAdapterConfig({
      ...makeDefaultValues("claude_local"),
      cwd: "/projects/test",
      model: "claude-opus-4-6",
      maxTurnsPerRun: 100,
    });
    expect(config.cwd).toBe("/projects/test");
    expect(config.model).toBe("claude-opus-4-6");
    expect(config.maxTurnsPerRun).toBe(100);
  });

  it("process includes command and args", () => {
    const adapter = getUIAdapter("process");
    const config = adapter.buildAdapterConfig({
      ...makeDefaultValues("process"),
      command: "node",
      args: "script.js, --flag",
    });
    expect(config.command).toBe("node");
    expect(config.args).toEqual(["script.js", "--flag"]);
  });

  it("http includes url and method", () => {
    const adapter = getUIAdapter("http");
    const config = adapter.buildAdapterConfig({
      ...makeDefaultValues("http"),
      url: "https://webhook.example.com/trigger",
    });
    expect(config.url).toBe("https://webhook.example.com/trigger");
    expect(config.method).toBe("POST");
    expect(config.timeoutMs).toBe(15000);
  });

  it("openclaw_gateway includes url and session strategy", () => {
    const adapter = getUIAdapter("openclaw_gateway");
    const config = adapter.buildAdapterConfig({
      ...makeDefaultValues("openclaw_gateway"),
      url: "ws://localhost:18789",
    });
    expect(config.url).toBe("ws://localhost:18789");
    expect(config.sessionKeyStrategy).toBe("issue");
    expect(config.role).toBe("operator");
  });

  it("codex_local defaults model when empty", () => {
    const adapter = getUIAdapter("codex_local");
    const config = adapter.buildAdapterConfig({
      ...makeDefaultValues("codex_local"),
      model: "",
    });
    expect(config.model).toBe("gpt-5.3-codex");
  });

  it("gemini_local defaults model when empty", () => {
    const adapter = getUIAdapter("gemini_local");
    const config = adapter.buildAdapterConfig({
      ...makeDefaultValues("gemini_local"),
      model: "",
    });
    expect(config.model).toBe("auto");
  });
});

describe("parseStdoutLine specifics", () => {
  it("claude_local parses init event", () => {
    const adapter = getUIAdapter("claude_local");
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      model: "claude-opus-4-6",
      session_id: "sess-123",
    });
    const entries = adapter.parseStdoutLine(line, "2025-01-01T00:00:00Z");
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("init");
    if (entries[0].kind === "init") {
      expect(entries[0].model).toBe("claude-opus-4-6");
      expect(entries[0].sessionId).toBe("sess-123");
    }
  });

  it("codex_local parses thread.started event", () => {
    const adapter = getUIAdapter("codex_local");
    const line = JSON.stringify({
      type: "thread.started",
      thread_id: "thread-abc",
      model: "gpt-5.3-codex",
    });
    const entries = adapter.parseStdoutLine(line, "2025-01-01T00:00:00Z");
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("init");
  });

  it("process parses plain text as stdout", () => {
    const adapter = getUIAdapter("process");
    const entries = adapter.parseStdoutLine("some output", "2025-01-01T00:00:00Z");
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("stdout");
    if (entries[0].kind === "stdout") {
      expect(entries[0].text).toBe("some output");
    }
  });

  it("http parses plain text as stdout", () => {
    const adapter = getUIAdapter("http");
    const entries = adapter.parseStdoutLine("response data", "2025-01-01T00:00:00Z");
    expect(entries).toHaveLength(1);
    expect(entries[0].kind).toBe("stdout");
  });
});
