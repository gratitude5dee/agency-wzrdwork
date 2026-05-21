import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { execute } from "../../packages/adapters/codex-local/src/server/execute";
import type { AdapterExecutionContext } from "../../packages/adapter-utils/src/types";

async function withTempDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

describe("codex local remote execution target bridge", () => {
  it("runs Codex through the sandbox target runner and exposes the remote cwd to the adapter", async () => {
    await withTempDir("paperclip-codex-remote-", async (root) => {
      const workspace = path.join(root, "workspace");
      const codexHome = path.join(root, "codex-home");
      await fs.mkdir(workspace, { recursive: true });

      const runnerExecute = vi.fn(async (input) => {
        expect(input.command).toBe("codex");
        expect(input.cwd).toBe("/vercel/sandbox/app");
        expect(input.env.CODEX_HOME).toBe("/vercel/sandbox/app/.paperclip-runtime/codex-home");
        expect(input.env.PAPERCLIP_WORKSPACE_CWD).toBe("/vercel/sandbox/app");
        expect(input.stdin).toContain("Run agent-1");
        return {
          exitCode: 0,
          signal: null,
          timedOut: false,
          stdout: [
            JSON.stringify({ type: "thread.started", thread_id: "thread-remote" }),
            JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "done" } }),
            JSON.stringify({ type: "turn.completed", usage: { input_tokens: 3, output_tokens: 5 } }),
            "",
          ].join("\n"),
          stderr: "",
          pid: null,
          startedAt: "2026-05-19T12:00:00.000Z",
        };
      });

      const result = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Agent One",
          adapterType: "codex_local",
          adapterConfig: null,
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          CODEX_HOME: codexHome,
          cwd: workspace,
          env: {
            CODEX_HOME: codexHome,
          },
          promptTemplate: "Run {{agent.id}}",
          timeoutSec: 9,
        },
        context: {
          paperclipWorkspace: {
            cwd: workspace,
            source: "project_primary",
            workspaceId: "workspace-1",
          },
        },
        executionTarget: {
          kind: "remote",
          transport: "sandbox",
          providerKey: "vercel",
          remoteCwd: "/vercel/sandbox/app",
          runner: {
            execute: runnerExecute,
          },
        },
        onLog: async () => {},
        onMeta: async (meta) => {
          expect(meta.cwd).toBe("/vercel/sandbox/app");
        },
      } satisfies AdapterExecutionContext);

      expect(runnerExecute).toHaveBeenCalledOnce();
      expect(result.exitCode).toBe(0);
      expect(result.summary).toBe("done");
      expect(result.sessionParams).toEqual({
        sessionId: "thread-remote",
        cwd: "/vercel/sandbox/app",
        workspaceId: "workspace-1",
      });
    });
  });
});
