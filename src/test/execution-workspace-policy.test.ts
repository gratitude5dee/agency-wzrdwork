import { describe, expect, it } from "vitest";

import {
  buildExecutionWorkspaceConfigSnapshot,
  resolveExecutionWorkspaceEnvironmentId,
} from "../../server/src/services/execution-workspace-policy";

describe("execution workspace environment policy", () => {
  it("resolves environment selection from persisted workspace, issue, project, then local default", () => {
    expect(
      resolveExecutionWorkspaceEnvironmentId({
        projectPolicy: { enabled: true, environmentId: "project-env" },
        issueSettings: { environmentId: "issue-env" },
        workspaceConfig: { environmentId: "workspace-env" },
        defaultEnvironmentId: "local-env",
      }),
    ).toBe("workspace-env");

    expect(
      resolveExecutionWorkspaceEnvironmentId({
        projectPolicy: { enabled: true, environmentId: "project-env" },
        issueSettings: { environmentId: null },
        workspaceConfig: null,
        defaultEnvironmentId: "local-env",
      }),
    ).toBe("local-env");

    expect(
      resolveExecutionWorkspaceEnvironmentId({
        projectPolicy: null,
        issueSettings: null,
        workspaceConfig: null,
        defaultEnvironmentId: "local-env",
      }),
    ).toBe("local-env");
  });

  it("snapshots the selected environment and managed runtime config for persisted workspaces", () => {
    expect(
      buildExecutionWorkspaceConfigSnapshot(
        {
          workspaceStrategy: {
            type: "git_worktree",
            provisionCommand: "pnpm install",
            teardownCommand: "pnpm clean",
          },
          workspaceRuntime: {
            services: [{ name: "web", command: "pnpm dev" }],
          },
          desiredState: "running",
          serviceStates: {
            web: "running",
            ignored: "paused",
          },
        },
        "sandbox-env",
      ),
    ).toEqual({
      environmentId: "sandbox-env",
      provisionCommand: "pnpm install",
      teardownCommand: "pnpm clean",
      workspaceRuntime: {
        services: [{ name: "web", command: "pnpm dev" }],
      },
      desiredState: "running",
      serviceStates: {
        web: "running",
      },
    });
  });
});
