import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

function writeAdapterPackage(input: {
  packageDir: string;
  packageName: string;
  type: string;
  version: string;
  marker: string;
  uiParserMarker?: string;
}) {
  mkdirSync(input.packageDir, { recursive: true });
  writeFileSync(
    path.join(input.packageDir, "package.json"),
    JSON.stringify({
      name: input.packageName,
      version: input.version,
      type: "module",
      exports: {
        ".": "./index.js",
        "./ui-parser": "./ui-parser.js",
      },
      paperclip: {
        adapterUiParser: "1.0.0",
      },
    }, null, 2) + "\n",
    "utf-8",
  );
  writeFileSync(
    path.join(input.packageDir, "index.js"),
    `
export function createServerAdapter() {
  return {
    type: ${JSON.stringify(input.type)},
    models: [{ id: ${JSON.stringify(input.marker)}, label: ${JSON.stringify(input.marker)} }],
    async execute() {
      return { exitCode: 0, signal: null, timedOut: false };
    },
    async testEnvironment() {
      return { adapterType: ${JSON.stringify(input.type)}, status: "pass", checks: [], testedAt: new Date(0).toISOString() };
    },
    async getConfigSchema() {
      return { fields: [{ key: "marker", label: "Marker", type: "text", default: ${JSON.stringify(input.marker)} }] };
    },
  };
}
`.trimStart(),
    "utf-8",
  );
  writeFileSync(
    path.join(input.packageDir, "ui-parser.js"),
    `export const marker = ${JSON.stringify(input.uiParserMarker ?? input.marker)};\n`,
    "utf-8",
  );
}

describe("external adapter plugin loader", () => {
  let previousPaperclipHome: string | undefined;
  let testHome: string;

  beforeEach(() => {
    previousPaperclipHome = process.env.PAPERCLIP_HOME;
    testHome = mkdtempSync(path.join(process.cwd(), ".tmp-paperclip-adapter-loader-"));
    process.env.PAPERCLIP_HOME = testHome;
  });

  afterEach(() => {
    if (previousPaperclipHome === undefined) {
      delete process.env.PAPERCLIP_HOME;
    } else {
      process.env.PAPERCLIP_HOME = previousPaperclipHome;
    }
    rmSync(testHome, { recursive: true, force: true });
  });

  it("loads a local adapter package and caches its UI parser", async () => {
    const type = `loader_test_${Date.now()}`;
    const packageDir = path.join(testHome, "external-adapter");
    writeAdapterPackage({
      packageDir,
      packageName: "@example/paperclip-loader-test",
      type,
      version: "1.0.0",
      marker: "v1",
      uiParserMarker: "parser-v1",
    });

    const loader = await import("../../server/src/adapters/plugin-loader");
    const adapter = await loader.loadExternalAdapterPackage("@example/paperclip-loader-test", packageDir);

    expect(adapter.type).toBe(type);
    expect(adapter.models?.[0]?.id).toBe("v1");
    expect(loader.getUiParserSource(type)).toContain("parser-v1");
  });

  it("reloads an installed external adapter from the plugin store", async () => {
    const type = `reload_test_${Date.now()}`;
    const packageName = "@example/paperclip-reload-test";
    const packageDir = path.join(testHome, "reload-adapter");
    writeAdapterPackage({
      packageDir,
      packageName,
      type,
      version: "1.0.0",
      marker: "v1",
    });

    const store = await import("../../server/src/services/adapter-plugin-store");
    const loader = await import("../../server/src/adapters/plugin-loader");
    store.addAdapterPlugin({
      packageName,
      localPath: packageDir,
      type,
      version: "1.0.0",
      installedAt: new Date("2026-05-19T00:00:00.000Z").toISOString(),
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    writeAdapterPackage({
      packageDir,
      packageName,
      type,
      version: "1.0.1",
      marker: "v2",
      uiParserMarker: "parser-v2",
    });

    const reloaded = await loader.reloadExternalAdapter(type);
    expect(reloaded?.models?.[0]?.id).toBe("v2");
    expect(loader.getOrExtractUiParserSource(type)).toContain("parser-v2");
  });
});
