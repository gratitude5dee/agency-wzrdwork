import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { API } from "../../packages/shared/dist/index.js";
import {
  addAdapterPlugin,
  getAdapterPluginByType,
  getAdapterPluginsDir,
  getDisabledAdapterTypes,
  isAdapterDisabled,
  listAdapterPlugins,
  removeAdapterPlugin,
  setAdapterDisabled,
} from "../../server/src/services/adapter-plugin-store";

describe("adapter plugin store", () => {
  let previousPaperclipHome: string | undefined;
  let testHome: string;

  beforeEach(() => {
    previousPaperclipHome = process.env.PAPERCLIP_HOME;
    testHome = mkdtempSync(path.join(os.tmpdir(), "paperclip-adapter-store-"));
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

  it("exports a stable adapter route handle", () => {
    expect(API.adapters).toBe("/api/adapters");
  });

  it("persists adapter plugin records by adapter type", () => {
    const installedAt = new Date("2026-05-19T12:00:00.000Z").toISOString();
    addAdapterPlugin({
      packageName: "@example/paperclip-adapter",
      version: "1.2.3",
      type: "example_adapter",
      installedAt,
    });
    addAdapterPlugin({
      packageName: "@example/paperclip-adapter",
      version: "1.2.4",
      type: "example_adapter",
      installedAt,
    });

    expect(getAdapterPluginsDir()).toBe(path.join(testHome, "adapter-plugins"));
    expect(listAdapterPlugins()).toHaveLength(1);
    expect(getAdapterPluginByType("example_adapter")).toMatchObject({
      packageName: "@example/paperclip-adapter",
      version: "1.2.4",
      type: "example_adapter",
    });
    expect(removeAdapterPlugin("example_adapter")).toBe(true);
    expect(removeAdapterPlugin("example_adapter")).toBe(false);
    expect(listAdapterPlugins()).toEqual([]);
  });

  it("persists disabled adapter settings idempotently", () => {
    expect(getDisabledAdapterTypes()).toEqual([]);
    expect(setAdapterDisabled("codex_local", true)).toBe(true);
    expect(setAdapterDisabled("codex_local", true)).toBe(false);
    expect(isAdapterDisabled("codex_local")).toBe(true);
    expect(getDisabledAdapterTypes()).toEqual(["codex_local"]);
    expect(setAdapterDisabled("codex_local", false)).toBe(true);
    expect(setAdapterDisabled("codex_local", false)).toBe(false);
    expect(isAdapterDisabled("codex_local")).toBe(false);
    expect(getDisabledAdapterTypes()).toEqual([]);
  });
});
