import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { environmentLeases } from "@paperclipai/db";
import type {
  Environment,
  EnvironmentLease,
  EnvironmentLeaseStatus,
  ExecutionWorkspace,
  SandboxEnvironmentConfig,
} from "@paperclipai/shared";
import { environmentService } from "./environments.js";
import { parseEnvironmentDriverConfig, resolveEnvironmentDriverConfigForRuntime } from "./environment-config.js";
import {
  acquireSandboxProviderLease,
  destroySandboxProviderLease,
  executeSandboxProviderCommand,
  findReusableSandboxProviderLeaseId,
  isBuiltinSandboxProvider,
  prepareSandboxProviderWorkspace,
  releaseSandboxProviderLease,
  resumeSandboxProviderLease,
  sandboxConfigFromLeaseMetadata,
  sandboxConfigFromLeaseMetadataLoose,
} from "./sandbox-provider-runtime.js";
import { buildWorkspaceRealizationRecordFromDriverInput } from "./workspace-realization.js";

export function buildEnvironmentLeaseContext(input: {
  persistedExecutionWorkspace: Pick<ExecutionWorkspace, "id" | "mode"> | null;
}) {
  return {
    executionWorkspaceId: input.persistedExecutionWorkspace?.id ?? null,
    executionWorkspaceMode: input.persistedExecutionWorkspace?.mode ?? null,
  };
}

export interface EnvironmentDriverAcquireInput {
  companyId: string;
  environment: Environment;
  issueId: string | null;
  heartbeatRunId: string | null;
  executionWorkspaceId: string | null;
  executionWorkspaceMode: ExecutionWorkspace["mode"] | null;
}

export interface EnvironmentDriverReleaseInput {
  environment: Environment;
  lease: EnvironmentLease;
  status: Extract<EnvironmentLeaseStatus, "released" | "expired" | "failed">;
}

export interface EnvironmentDriverLeaseInput {
  environment: Environment;
  lease: EnvironmentLease;
}

export interface EnvironmentDriverRealizeWorkspaceInput extends EnvironmentDriverLeaseInput {
  workspace: {
    localPath?: string;
    remotePath?: string;
    mode?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface EnvironmentDriverExecuteInput extends EnvironmentDriverLeaseInput {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdin?: string;
  timeoutMs?: number;
}

export interface EnvironmentRuntimeRealizeWorkspaceResult {
  cwd: string;
  metadata?: Record<string, unknown>;
}

export interface EnvironmentRuntimeExecuteResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  signal?: string | null;
  timedOut?: boolean | null;
}

export interface EnvironmentRuntimeDriver {
  readonly driver: string;
  acquireRunLease(input: EnvironmentDriverAcquireInput): Promise<EnvironmentLease>;
  releaseRunLease(input: EnvironmentDriverReleaseInput): Promise<EnvironmentLease | null>;
  resumeRunLease?(input: EnvironmentDriverLeaseInput): Promise<EnvironmentLease | { providerLeaseId: string | null; metadata?: Record<string, unknown> } | null>;
  destroyRunLease?(input: EnvironmentDriverLeaseInput): Promise<EnvironmentLease | null>;
  realizeWorkspace?(input: EnvironmentDriverRealizeWorkspaceInput): Promise<EnvironmentRuntimeRealizeWorkspaceResult>;
  execute?(input: EnvironmentDriverExecuteInput): Promise<EnvironmentRuntimeExecuteResult>;
}

export interface EnvironmentRuntimeLeaseRecord {
  environment: Environment;
  lease: EnvironmentLease;
  leaseContext: ReturnType<typeof buildEnvironmentLeaseContext>;
}

function getLeaseDriverKey(lease: Pick<EnvironmentLease, "metadata">, environment: Pick<Environment, "driver">): string {
  const leaseDriver = typeof lease.metadata?.driver === "string" ? lease.metadata.driver : null;
  return leaseDriver ?? environment.driver;
}

function toEnvironmentLease(row: typeof environmentLeases.$inferSelect): EnvironmentLease {
  return {
    id: row.id,
    companyId: row.companyId,
    environmentId: row.environmentId,
    executionWorkspaceId: row.executionWorkspaceId ?? null,
    issueId: row.issueId ?? null,
    heartbeatRunId: row.heartbeatRunId ?? null,
    status: row.status as EnvironmentLease["status"],
    leasePolicy: row.leasePolicy as EnvironmentLease["leasePolicy"],
    provider: row.provider ?? null,
    providerLeaseId: row.providerLeaseId ?? null,
    acquiredAt: row.acquiredAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt ?? null,
    releasedAt: row.releasedAt ?? null,
    failureReason: row.failureReason ?? null,
    cleanupStatus: row.cleanupStatus as EnvironmentLease["cleanupStatus"],
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function findReusableSandboxLeaseId(input: {
  config: SandboxEnvironmentConfig;
  leases: Array<Pick<EnvironmentLease, "providerLeaseId" | "metadata">>;
}): string | null {
  return findReusableSandboxProviderLeaseId(input);
}

function createLocalEnvironmentDriver(db: Db): EnvironmentRuntimeDriver {
  const environmentsSvc = environmentService(db);

  return {
    driver: "local",

    async acquireRunLease(input) {
      return await environmentsSvc.acquireLease({
        companyId: input.companyId,
        environmentId: input.environment.id,
        executionWorkspaceId: input.executionWorkspaceId,
        issueId: input.issueId,
        heartbeatRunId: input.heartbeatRunId,
        leasePolicy: "ephemeral",
        provider: "local",
        metadata: {
          driver: input.environment.driver,
          executionWorkspaceMode: input.executionWorkspaceMode,
        },
      });
    },

    async releaseRunLease(input) {
      return await environmentsSvc.releaseLease(input.lease.id, input.status);
    },

    async realizeWorkspace(input) {
      const record = buildWorkspaceRealizationRecordFromDriverInput({
        environment: input.environment,
        lease: input.lease,
        workspace: input.workspace,
        cwd: input.workspace.localPath ?? input.workspace.remotePath ?? null,
      });
      return {
        cwd: input.workspace.localPath ?? input.workspace.remotePath ?? "/",
        metadata: {
          workspaceRealization: record,
        },
      };
    },
  };
}

function createUnsupportedRemoteDriver(driver: "ssh" | "plugin", db: Db): EnvironmentRuntimeDriver {
  const environmentsSvc = environmentService(db);
  return {
    driver,
    async acquireRunLease() {
      throw new Error(
        `Environment driver "${driver}" needs its provider runtime installed before it can acquire run leases.`,
      );
    },
    async releaseRunLease(input) {
      return await environmentsSvc.releaseLease(input.lease.id, input.status, {
        cleanupStatus: "failed",
      });
    },
  };
}

function createSandboxEnvironmentDriver(db: Db): EnvironmentRuntimeDriver {
  const environmentsSvc = environmentService(db);

  function parseSandboxConfigForLease(input: {
    environment: Environment;
    lease: EnvironmentLease;
  }): SandboxEnvironmentConfig | null {
    return sandboxConfigFromLeaseMetadata(input.lease) ??
      sandboxConfigFromLeaseMetadataLoose(input.lease) ??
      (input.environment.driver === "sandbox"
        ? parseEnvironmentDriverConfig(input.environment).config as SandboxEnvironmentConfig
        : null);
  }

  return {
    driver: "sandbox",

    async acquireRunLease(input) {
      const parsed = await resolveEnvironmentDriverConfigForRuntime(db, input.companyId, input.environment);
      if (parsed.driver !== "sandbox") {
        throw new Error(`Expected sandbox environment config for driver "${input.environment.driver}".`);
      }
      if (!isBuiltinSandboxProvider(parsed.config.provider)) {
        throw new Error(
          `Sandbox provider "${parsed.config.provider}" is not registered as a built-in provider in this Agency runtime yet.`,
        );
      }

      const reusableProviderLeaseId = parsed.config.reuseLease && input.heartbeatRunId !== null
        ? (await environmentsSvc
            .listLeases(input.environment.id)
            .then((leases) =>
              findReusableSandboxLeaseId({
                config: parsed.config,
                leases: leases.filter((lease) => lease.leasePolicy === "reuse_by_environment"),
              }),
            ))
        : null;

      const providerLease = await acquireSandboxProviderLease({
        config: parsed.config,
        environmentId: input.environment.id,
        heartbeatRunId: input.heartbeatRunId ?? randomUUID(),
        issueId: input.issueId,
        reusableProviderLeaseId,
      });

      const resolvedLeasePolicy = parsed.config.reuseLease && input.heartbeatRunId !== null
        ? "reuse_by_environment"
        : "ephemeral";

      return await environmentsSvc.acquireLease({
        companyId: input.companyId,
        environmentId: input.environment.id,
        executionWorkspaceId: input.executionWorkspaceId,
        issueId: input.issueId,
        heartbeatRunId: input.heartbeatRunId,
        leasePolicy: resolvedLeasePolicy,
        provider: parsed.config.provider,
        providerLeaseId: providerLease.providerLeaseId,
        metadata: {
          driver: input.environment.driver,
          executionWorkspaceMode: input.executionWorkspaceMode,
          ...providerLease.metadata,
        },
      });
    },

    async releaseRunLease(input) {
      const config = parseSandboxConfigForLease(input);
      if (!config) {
        return await environmentsSvc.releaseLease(input.lease.id, input.status, {
          cleanupStatus: "failed",
          failureReason: input.status === "failed" ? "adapter_or_run_failure" : undefined,
        });
      }

      let cleanupStatus: "success" | "failed" = "success";
      try {
        await releaseSandboxProviderLease({
          config,
          providerLeaseId: input.lease.providerLeaseId,
          status: input.status,
        });
      } catch {
        cleanupStatus = "failed";
      }
      const releaseStatus = input.lease.leasePolicy === "retain_on_failure" && input.status === "failed"
        ? "retained" as const
        : input.status;
      return await environmentsSvc.releaseLease(input.lease.id, releaseStatus, {
        failureReason: input.status === "failed" ? "adapter_or_run_failure" : undefined,
        cleanupStatus,
      });
    },

    async resumeRunLease(input) {
      const config = parseSandboxConfigForLease(input);
      if (!config || !input.lease.providerLeaseId) return null;
      return await resumeSandboxProviderLease({
        config,
        providerLeaseId: input.lease.providerLeaseId,
      });
    },

    async destroyRunLease(input) {
      const config = parseSandboxConfigForLease(input);
      if (config) {
        await destroySandboxProviderLease({
          config,
          providerLeaseId: input.lease.providerLeaseId,
        });
      }
      return await environmentsSvc.releaseLease(input.lease.id, "failed", {
        cleanupStatus: config ? "success" : "failed",
        failureReason: "destroyed_by_environment_runtime",
      });
    },

    async realizeWorkspace(input) {
      const config = parseSandboxConfigForLease(input);
      const prepared = config
        ? await prepareSandboxProviderWorkspace({
            config,
            providerLeaseId: input.lease.providerLeaseId,
            workspace: input.workspace,
          })
        : {};
      const record = buildWorkspaceRealizationRecordFromDriverInput({
        environment: input.environment,
        lease: input.lease,
        workspace: input.workspace,
        cwd:
          prepared.remotePath ??
          (typeof input.lease.metadata?.remoteCwd === "string" ? input.lease.metadata.remoteCwd : null) ??
          input.workspace.remotePath ??
          input.workspace.localPath ??
          null,
        providerMetadata: prepared.metadata,
      });
      return {
        cwd: record.remote.path ?? record.local.path,
        metadata: {
          workspaceRealization: record,
        },
      };
    },

    async execute(input) {
      const config = parseSandboxConfigForLease(input);
      if (!config) {
        throw new Error(`Sandbox lease "${input.lease.id}" does not contain a recoverable provider config.`);
      }
      return await executeSandboxProviderCommand({
        config,
        providerLeaseId: input.lease.providerLeaseId,
        command: input.command,
        args: input.args,
        cwd: input.cwd,
        env: input.env,
        stdin: input.stdin,
        timeoutMs: input.timeoutMs,
      });
    },
  };
}

export function environmentRuntimeService(
  db: Db,
  options: {
    drivers?: EnvironmentRuntimeDriver[];
  } = {},
) {
  const environmentsSvc = environmentService(db);
  const drivers = new Map<string, EnvironmentRuntimeDriver>();
  const defaultDrivers = [
    createLocalEnvironmentDriver(db),
    createSandboxEnvironmentDriver(db),
    createUnsupportedRemoteDriver("ssh", db),
    createUnsupportedRemoteDriver("plugin", db),
  ];

  for (const driver of options.drivers ?? defaultDrivers) {
    drivers.set(driver.driver, driver);
  }

  function getDriver(driverKey: string): EnvironmentRuntimeDriver | null {
    return drivers.get(driverKey) ?? null;
  }

  function requireDriver(environment: Pick<Environment, "driver">): EnvironmentRuntimeDriver {
    const driver = getDriver(environment.driver);
    if (!driver) {
      throw new Error(
        `Environment driver "${environment.driver}" is not registered in the environment runtime yet.`,
      );
    }
    return driver;
  }

  function requireDriverKey(driverKey: string): EnvironmentRuntimeDriver {
    const driver = getDriver(driverKey);
    if (!driver) {
      throw new Error(
        `Environment driver "${driverKey}" is not registered in the environment runtime yet.`,
      );
    }
    return driver;
  }

  return {
    getDriver,

    async acquireRunLease(input: {
      companyId: string;
      environment: Environment;
      issueId: string | null;
      heartbeatRunId: string | null;
      persistedExecutionWorkspace: Pick<ExecutionWorkspace, "id" | "mode"> | null;
    }): Promise<EnvironmentRuntimeLeaseRecord> {
      if (input.environment.status !== "active") {
        throw new Error(`Environment "${input.environment.name}" is not active.`);
      }

      const leaseContext = buildEnvironmentLeaseContext({
        persistedExecutionWorkspace: input.persistedExecutionWorkspace,
      });
      const driver = requireDriver(input.environment);
      const lease = await driver.acquireRunLease({
        companyId: input.companyId,
        environment: input.environment,
        issueId: input.issueId,
        heartbeatRunId: input.heartbeatRunId,
        executionWorkspaceId: leaseContext.executionWorkspaceId,
        executionWorkspaceMode: leaseContext.executionWorkspaceMode,
      });

      return {
        environment: input.environment,
        lease,
        leaseContext,
      };
    },

    async releaseRunLeases(
      heartbeatRunId: string,
      status: Extract<EnvironmentLeaseStatus, "released" | "expired" | "failed"> = "released",
    ): Promise<EnvironmentRuntimeLeaseRecord[]> {
      const leaseRows = await db
        .select()
        .from(environmentLeases)
        .where(
          and(
            eq(environmentLeases.heartbeatRunId, heartbeatRunId),
            inArray(environmentLeases.status, ["active"]),
          ),
        );
      if (leaseRows.length === 0) {
        return [];
      }

      const released: EnvironmentRuntimeLeaseRecord[] = [];
      for (const leaseRow of leaseRows) {
        const environment = await environmentsSvc.getById(leaseRow.environmentId);
        if (!environment) continue;

        const leaseSnapshot = toEnvironmentLease(leaseRow);
        const driver = getDriver(getLeaseDriverKey(leaseSnapshot, environment));
        const lease = driver
          ? await driver.releaseRunLease({
              environment,
              lease: leaseSnapshot,
              status,
            })
          : await environmentsSvc.releaseLease(leaseRow.id, status);
        if (!lease) continue;

        released.push({
          environment,
          lease,
          leaseContext: {
            executionWorkspaceId: lease.executionWorkspaceId,
            executionWorkspaceMode:
              (lease.metadata?.executionWorkspaceMode as ExecutionWorkspace["mode"] | null | undefined) ?? null,
          },
        });
      }

      return released;
    },

    async resumeRunLease(input: EnvironmentDriverLeaseInput) {
      const driver = requireDriverKey(getLeaseDriverKey(input.lease, input.environment));
      if (!driver.resumeRunLease) {
        throw new Error(`Environment driver "${driver.driver}" does not support lease resume.`);
      }
      return await driver.resumeRunLease(input);
    },

    async destroyRunLease(input: EnvironmentDriverLeaseInput): Promise<EnvironmentLease | null> {
      const driver = requireDriverKey(getLeaseDriverKey(input.lease, input.environment));
      if (!driver.destroyRunLease) {
        throw new Error(`Environment driver "${driver.driver}" does not support lease destroy.`);
      }
      return await driver.destroyRunLease(input);
    },

    async realizeWorkspace(
      input: EnvironmentDriverRealizeWorkspaceInput,
    ): Promise<EnvironmentRuntimeRealizeWorkspaceResult> {
      const driver = requireDriverKey(getLeaseDriverKey(input.lease, input.environment));
      if (!driver.realizeWorkspace) {
        throw new Error(`Environment driver "${driver.driver}" does not support workspace realization.`);
      }
      return await driver.realizeWorkspace(input);
    },

    async execute(input: EnvironmentDriverExecuteInput): Promise<EnvironmentRuntimeExecuteResult> {
      const driver = requireDriverKey(getLeaseDriverKey(input.lease, input.environment));
      if (!driver.execute) {
        throw new Error(`Environment driver "${driver.driver}" does not support command execution.`);
      }
      return await driver.execute(input);
    },
  };
}

export type EnvironmentRuntimeService = ReturnType<typeof environmentRuntimeService>;
