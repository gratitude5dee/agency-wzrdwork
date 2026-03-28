import { describe, it, expect } from "vitest";
import { adapterRegistry, getUIAdapter } from "@/adapters/registry";
import {
  buildHermesConfig,
  getHermesExtras,
  HERMES_DEFAULT_MODEL,
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

// ---------------------------------------------------------------------------
// VAL-HERMES-004: Saved Hermes agents resolve through the adapter registry
// ---------------------------------------------------------------------------

describe("Hermes adapter registry resolution (VAL-HERMES-004)", () => {
  it("getUIAdapter('hermes') returns hermes, NOT the process fallback", () => {
    const adapter = getUIAdapter("hermes");
    expect(adapter.type).toBe("hermes");
    // Crucially, it should NOT fall back to 'process'
    expect(adapter.type).not.toBe("process");
  });

  it("adapterRegistry.get('hermes') returns a defined adapter module", () => {
    const adapter = adapterRegistry.get("hermes");
    expect(adapter).toBeDefined();
    expect(adapter!.type).toBe("hermes");
    expect(adapter!.label).toBe("Hermes Agent");
  });

  it("hermes adapter has all required interface methods", () => {
    const adapter = getUIAdapter("hermes");
    expect(typeof adapter.parseStdoutLine).toBe("function");
    expect(typeof adapter.ConfigFields).toBe("function");
    expect(typeof adapter.buildAdapterConfig).toBe("function");
  });

  it("registry does NOT fall back for exact 'hermes' key", () => {
    // Verify the registry has the key (not just fallback behavior)
    expect(adapterRegistry.has("hermes")).toBe(true);
    const directLookup = adapterRegistry.get("hermes");
    const getUIResult = getUIAdapter("hermes");
    // Both should return the same adapter
    expect(directLookup).toBe(getUIResult);
  });
});

// ---------------------------------------------------------------------------
// VAL-HERMES-002: Hermes config serialization produces valid, non-empty config
// ---------------------------------------------------------------------------

describe("Hermes config persistence shape (VAL-HERMES-002)", () => {
  it("buildHermesConfig produces a complete config with all required fields", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(config).toHaveProperty("hermes_home");
    expect(config).toHaveProperty("model");
    expect(config).toHaveProperty("provider");
    expect(config).toHaveProperty("enabled_toolsets");
    expect(config).toHaveProperty("memory_mode");
    expect(config).toHaveProperty("mcp_servers");
    expect(config).toHaveProperty("max_turns");
  });

  it("default config is non-empty (not a placeholder)", () => {
    const config = buildHermesConfig(makeDefaultValues());
    expect(config.model).toBeTruthy();
    expect(config.model).toBe(HERMES_DEFAULT_MODEL);
    expect(config.provider).toBeTruthy();
    expect(Array.isArray(config.enabled_toolsets)).toBe(true);
    expect((config.enabled_toolsets as string[]).length).toBeGreaterThan(0);
    expect(config.memory_mode).toBeTruthy();
  });

  it("serialized config can be round-tripped through JSON without data loss", () => {
    const config = buildHermesConfig(makeDefaultValues());
    const serialized = JSON.stringify(config);
    const deserialized = JSON.parse(serialized);
    expect(deserialized).toEqual(config);
  });

  it("config with custom extras serializes correctly", () => {
    const values = makeDefaultValues({
      envBindings: {
        __hermes_extras__: {
          hermesModel: "openai/gpt-4o",
          hermesProvider: "openrouter",
          enabledToolsets: ["web", "browser", "delegate"],
          memoryMode: "honcho",
          mcpServers: [{ name: "my-mcp", url: "https://mcp.example.com" }],
        },
      },
    });
    const config = buildHermesConfig(values);
    expect(config.model).toBe("openai/gpt-4o");
    expect(config.provider).toBe("openrouter");
    expect(config.enabled_toolsets).toEqual(["web", "browser", "delegate"]);
    expect(config.memory_mode).toBe("honcho");
    expect(config.mcp_servers).toEqual([{ name: "my-mcp", url: "https://mcp.example.com" }]);
  });
});

// ---------------------------------------------------------------------------
// VAL-HERMES-001 + VAL-HERMES-003: Onboarding harness config building
// ---------------------------------------------------------------------------

describe("Hermes default config for onboarding harness selection (VAL-HERMES-001/003)", () => {
  it("buildHermesConfig with plain defaults produces a usable runtime config", () => {
    // This simulates the onboarding path where no extras are configured
    const config = buildHermesConfig(makeDefaultValues());
    // The config should be immediately usable (valid model, valid defaults)
    expect(config.model).toBe(HERMES_DEFAULT_MODEL);
    expect(config.provider).toBe("auto");
    expect((config.enabled_toolsets as string[]).length).toBeGreaterThan(0);
    expect(config.memory_mode).toBe("local");
    expect(config.max_turns).toBe(90);
  });

  it("getHermesExtras returns sensible defaults for empty envBindings", () => {
    const extras = getHermesExtras(makeDefaultValues());
    expect(extras.hermesModel).toBe(HERMES_DEFAULT_MODEL);
    expect(extras.hermesProvider).toBe("auto");
    expect(extras.enabledToolsets).toEqual(["web", "terminal", "file", "code"]);
    expect(extras.memoryMode).toBe("local");
    expect(extras.mcpServers).toEqual([]);
  });
});
