import { describe, expect, it } from "vitest";
import type { Request } from "express";

import { HttpError } from "../../server/src/errors";
import {
  assertNoAgentHostWorkspaceCommandMutation,
  collectAgentAdapterWorkspaceCommandPaths,
  collectExecutionWorkspaceCommandPaths,
  collectIssueWorkspaceCommandPaths,
  collectProjectExecutionWorkspaceCommandPaths,
  collectProjectWorkspaceCommandPaths,
} from "../../server/src/routes/workspace-command-authz";

function requestForActor(type: "agent" | "board"): Request {
  return {
    actor: type === "agent"
      ? { type: "agent", agentId: "agent-1" }
      : { type: "board", userId: "board-1" },
  } as unknown as Request;
}

describe("workspace command authorization helpers", () => {
  it("collects host-executed command paths from workspace-capable payloads", () => {
    expect(collectAgentAdapterWorkspaceCommandPaths({
      workspaceStrategy: {
        provisionCommand: "pnpm install",
        teardownCommand: "pnpm clean",
      },
    })).toEqual([
      "adapterConfig.workspaceStrategy.provisionCommand",
      "adapterConfig.workspaceStrategy.teardownCommand",
    ]);

    expect(collectProjectExecutionWorkspaceCommandPaths({
      workspaceStrategy: { teardownCommand: "git worktree remove" },
    })).toEqual(["executionWorkspacePolicy.workspaceStrategy.teardownCommand"]);

    expect(collectProjectWorkspaceCommandPaths({ cleanupCommand: "rm -rf tmp" })).toEqual([
      "cleanupCommand",
    ]);

    expect(collectIssueWorkspaceCommandPaths({
      executionWorkspaceSettings: {
        workspaceStrategy: { provisionCommand: "setup" },
      },
      assigneeAdapterOverrides: {
        adapterConfig: {
          workspaceStrategy: { teardownCommand: "teardown" },
        },
      },
    })).toEqual([
      "executionWorkspaceSettings.workspaceStrategy.provisionCommand",
      "assigneeAdapterOverrides.adapterConfig.workspaceStrategy.teardownCommand",
    ]);

    expect(collectExecutionWorkspaceCommandPaths({
      config: { cleanupCommand: "cleanup" },
      metadata: { config: { provisionCommand: "provision" } },
    })).toEqual(["config.cleanupCommand", "metadata.config.provisionCommand"]);
  });

  it("rejects agent mutations that would change host-executed workspace commands", () => {
    expect(() =>
      assertNoAgentHostWorkspaceCommandMutation(requestForActor("agent"), ["config.cleanupCommand"]),
    ).toThrow(HttpError);

    try {
      assertNoAgentHostWorkspaceCommandMutation(requestForActor("agent"), ["config.cleanupCommand"]);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(403);
      expect((error as Error).message).toContain("Agent keys cannot modify host-executed workspace commands");
    }
  });

  it("allows board callers and agent payloads without host command paths", () => {
    expect(() =>
      assertNoAgentHostWorkspaceCommandMutation(requestForActor("board"), ["config.cleanupCommand"]),
    ).not.toThrow();
    expect(() =>
      assertNoAgentHostWorkspaceCommandMutation(requestForActor("agent"), []),
    ).not.toThrow();
  });
});
