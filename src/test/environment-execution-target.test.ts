import { describe, expect, it } from "vitest";

import {
  DEFAULT_SANDBOX_REMOTE_CWD,
  resolveEnvironmentExecutionTarget,
} from "../../server/src/services/environment-execution-target";
import { buildWorkspaceRealizationRecordFromDriverInput } from "../../server/src/services/workspace-realization";
import type { Environment, EnvironmentLease } from "../../packages/shared/dist/index.js";

function environment(overrides: Partial<Environment> = {}): Environment {
  return {
    id: "env-1",
    companyId: "company-1",
    name: "Sandbox",
    description: null,
    driver: "sandbox",
    status: "active",
    config: {
      provider: "vercel",
      runtime: "node24",
      reuseLease: true,
      timeoutMs: 300_000,
    },
    metadata: null,
    createdAt: new Date("2026-05-19T12:00:00.000Z"),
    updatedAt: new Date("2026-05-19T12:00:00.000Z"),
    ...overrides,
  };
}

function lease(overrides: Partial<EnvironmentLease> = {}): EnvironmentLease {
  return {
    id: "lease-1",
    companyId: "company-1",
    environmentId: "env-1",
    executionWorkspaceId: "workspace-1",
    issueId: "issue-1",
    heartbeatRunId: "run-1",
    status: "active",
    leasePolicy: "reuse_by_environment",
    provider: "vercel",
    providerLeaseId: "sandbox_123",
    acquiredAt: new Date("2026-05-19T12:00:00.000Z"),
    lastUsedAt: new Date("2026-05-19T12:00:00.000Z"),
    expiresAt: null,
    releasedAt: null,
    failureReason: null,
    cleanupStatus: null,
    metadata: {
      provider: "vercel",
      runtime: "node24",
      reuseLease: true,
      remoteCwd: "/vercel/sandbox/app",
      shellCommand: "bash",
      sandboxId: "sandbox_123",
    },
    createdAt: new Date("2026-05-19T12:00:00.000Z"),
    updatedAt: new Date("2026-05-19T12:00:00.000Z"),
    ...overrides,
  };
}

describe("environment execution target", () => {
  it("resolves local environments to local adapter targets", async () => {
    await expect(resolveEnvironmentExecutionTarget({
      db: {} as never,
      companyId: "company-1",
      adapterType: "codex_local",
      environment: environment({
        driver: "local",
        config: {},
      }),
      leaseId: "lease-local",
      leaseMetadata: null,
    })).resolves.toEqual({
      kind: "local",
      environmentId: "env-1",
      leaseId: "lease-local",
    });
  });

  it("resolves sandbox leases to remote targets with runtime runners", async () => {
    const target = await resolveEnvironmentExecutionTarget({
      db: {} as never,
      companyId: "company-1",
      adapterType: "codex_local",
      environment: environment(),
      leaseId: "lease-1",
      lease: lease(),
      leaseMetadata: lease().metadata,
      environmentRuntime: {
        execute: async (input) => ({
          exitCode: 0,
          stdout: `${input.command} ${(input.args ?? []).join(" ")}`,
          stderr: "",
          timedOut: false,
          signal: null,
        }),
      } as never,
    });

    expect(target).toMatchObject({
      kind: "remote",
      transport: "sandbox",
      providerKey: "vercel",
      shellCommand: "bash",
      remoteCwd: "/vercel/sandbox/app",
      timeoutMs: 300_000,
    });

    if (target?.kind !== "remote" || target.transport !== "sandbox" || !target.runner) {
      throw new Error("Expected sandbox target with runner.");
    }

    await expect(target.runner.execute({
      command: "node",
      args: ["--version"],
    })).resolves.toMatchObject({
      exitCode: 0,
      stdout: "node --version",
      pid: null,
    });
  });

  it("falls back to the Vercel Sandbox working directory", async () => {
    const target = await resolveEnvironmentExecutionTarget({
      db: {} as never,
      companyId: "company-1",
      adapterType: "codex_local",
      environment: environment(),
      leaseId: "lease-1",
      leaseMetadata: {},
    });

    expect(target).toMatchObject({
      kind: "remote",
      transport: "sandbox",
      remoteCwd: DEFAULT_SANDBOX_REMOTE_CWD,
    });
  });
});

describe("workspace realization records", () => {
  it("summarizes sandbox workspace realization metadata", () => {
    const record = buildWorkspaceRealizationRecordFromDriverInput({
      environment: environment(),
      lease: lease(),
      workspace: {
        localPath: "/Users/alice/project",
        remotePath: "/vercel/sandbox/app",
        mode: "isolated_workspace",
      },
    });

    expect(record).toMatchObject({
      transport: "sandbox",
      provider: "vercel",
      environmentId: "env-1",
      leaseId: "lease-1",
      providerLeaseId: "sandbox_123",
      local: {
        path: "/Users/alice/project",
      },
      remote: {
        path: "/vercel/sandbox/app",
        sandboxId: "sandbox_123",
      },
      sync: {
        strategy: "sandbox_archive_upload_download",
      },
    });
  });
});
