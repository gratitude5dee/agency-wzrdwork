import { describe, expect, it, vi } from "vitest";

import { runChildProcess } from "../../packages/adapter-utils/dist/server-utils.js";
import type { AdapterExecutionTarget } from "../../packages/adapter-utils/dist/execution-target.js";

describe("adapter execution target runner", () => {
  it("routes sandbox execution targets through their managed runner", async () => {
    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    const execute = vi.fn(async (input) => {
      expect(input.command).toBe("node");
      expect(input.args).toEqual(["script.js"]);
      expect(input.cwd).toBe("/vercel/sandbox/app");
      expect(input.env).toEqual({ FOO: "bar" });
      expect(input.timeoutMs).toBe(7000);
      await input.onLog?.("stdout", "remote ok\n");
      return {
        exitCode: 0,
        signal: null,
        timedOut: false,
        stdout: "remote ok\n",
        stderr: "",
        pid: null,
        startedAt: "2026-05-19T12:00:00.000Z",
      };
    });
    const executionTarget: AdapterExecutionTarget = {
      kind: "remote",
      transport: "sandbox",
      providerKey: "fake",
      remoteCwd: "/vercel/sandbox/app",
      runner: { execute },
    };

    const result = await runChildProcess("run-1", "node", ["script.js"], {
      cwd: "/local/workspace",
      env: { FOO: "bar" },
      timeoutSec: 7,
      graceSec: 1,
      executionTarget,
      onLog: async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: "remote ok\n",
      stderr: "",
    });
    expect(result.pid).toBeNull();
    expect(typeof result.startedAt).toBe("string");
    expect(logs).toEqual([{ stream: "stdout", chunk: "remote ok\n" }]);
  });
});
