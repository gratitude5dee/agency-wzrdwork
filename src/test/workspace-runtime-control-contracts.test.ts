import { describe, expect, it } from "vitest";

import {
  findWorkspaceCommandDefinition,
  listWorkspaceCommandDefinitions,
  matchWorkspaceRuntimeServiceToCommand,
} from "../../packages/shared/src/workspace-commands.ts";
import { workspaceRuntimeControlTargetSchema } from "../../packages/shared/src/validators/execution-workspace.ts";
import {
  mergeProjectWorkspaceRuntimeConfig,
  readProjectWorkspaceRuntimeConfig,
} from "../../server/src/services/project-workspace-runtime-config";

describe("workspace runtime control contracts", () => {
  it("normalizes service and job commands from workspace runtime config", () => {
    const commands = listWorkspaceCommandDefinitions({
      services: [
        {
          name: "Web",
          command: "pnpm dev",
          cwd: "apps/web",
        },
      ],
      jobs: [
        {
          id: "typecheck",
          name: "Typecheck",
          command: "pnpm typecheck",
        },
      ],
    });

    expect(commands).toEqual([
      expect.objectContaining({
        id: "service:web",
        kind: "service",
        serviceIndex: 0,
        command: "pnpm dev",
      }),
      expect.objectContaining({
        id: "typecheck",
        kind: "job",
        serviceIndex: null,
        command: "pnpm typecheck",
      }),
    ]);
    expect(findWorkspaceCommandDefinition({ services: [{ id: "web", command: "pnpm dev" }] }, "web"))
      .toEqual(expect.objectContaining({ id: "web", kind: "service" }));
  });

  it("matches running runtime services back to their configured command", () => {
    const command = findWorkspaceCommandDefinition({
      services: [
        {
          name: "Web",
          command: "pnpm dev",
          cwd: "apps/web",
        },
      ],
    }, "service:web");

    expect(command).toBeTruthy();
    expect(matchWorkspaceRuntimeServiceToCommand(command!, [
      {
        configIndex: null,
        serviceName: "Docs",
        command: "pnpm docs",
        cwd: "/repo/apps/docs",
      },
      {
        configIndex: null,
        serviceName: "Web",
        command: "pnpm dev",
        cwd: "/repo/apps/web",
      },
    ])).toEqual(expect.objectContaining({ serviceName: "Web" }));
  });

  it("validates runtime control targets and rejects malformed service ids", () => {
    expect(workspaceRuntimeControlTargetSchema.parse({
      workspaceCommandId: "web",
      serviceIndex: 0,
    })).toEqual({
      workspaceCommandId: "web",
      serviceIndex: 0,
    });

    expect(() => workspaceRuntimeControlTargetSchema.parse({
      runtimeServiceId: "not-a-uuid",
    })).toThrow();
  });

  it("merges project workspace runtime desired state into metadata without losing siblings", () => {
    const current = {
      display: { color: "blue" },
      runtimeConfig: {
        workspaceRuntime: {
          services: [{ id: "web", command: "pnpm dev" }],
        },
        desiredState: "stopped",
      },
    };

    const merged = mergeProjectWorkspaceRuntimeConfig(current, {
      desiredState: "running",
      serviceStates: { "0": "running" },
    });

    expect(merged).toEqual({
      display: { color: "blue" },
      runtimeConfig: {
        workspaceRuntime: {
          services: [{ id: "web", command: "pnpm dev" }],
        },
        desiredState: "running",
        serviceStates: { "0": "running" },
      },
    });
    expect(readProjectWorkspaceRuntimeConfig(merged)).toEqual({
      workspaceRuntime: {
        services: [{ id: "web", command: "pnpm dev" }],
      },
      desiredState: "running",
      serviceStates: { "0": "running" },
    });
  });
});
