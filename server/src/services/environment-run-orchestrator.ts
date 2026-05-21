import type { Db } from "@paperclipai/db";
import type {
  Environment,
  EnvironmentLease,
  EnvironmentLeaseStatus,
  ExecutionWorkspace,
} from "@paperclipai/shared";
import {
  adapterExecutionTargetToRemoteSpec,
  type AdapterExecutionTarget,
} from "@paperclipai/adapter-utils/execution-target";
import { parseObject } from "../adapters/utils.js";
import { logActivity } from "./activity-log.js";
import { environmentService } from "./environments.js";
import {
  buildEnvironmentLeaseContext,
  environmentRuntimeService,
  type EnvironmentRuntimeLeaseRecord,
  type EnvironmentRuntimeService,
} from "./environment-runtime.js";
import {
  resolveEnvironmentExecutionTarget,
  resolveEnvironmentExecutionTransport,
} from "./environment-execution-target.js";
import { executionWorkspaceService } from "./execution-workspaces.js";
import { buildWorkspaceRealizationRequest } from "./workspace-realization.js";
import type { RealizedExecutionWorkspace } from "./workspace-runtime.js";

export type EnvironmentErrorCode =
  | "environment_not_found"
  | "environment_inactive"
  | "unsupported_environment"
  | "unsupported_adapter_environment"
  | "lease_acquire_failed"
  | "workspace_realization_failed"
  | "transport_resolution_failed"
  | "lease_release_failed";

export class EnvironmentRunError extends Error {
  code: EnvironmentErrorCode;
  environmentId?: string;
  driver?: string;
  provider?: string;
  cause?: unknown;

  constructor(
    code: EnvironmentErrorCode,
    message: string,
    details?: {
      environmentId?: string;
      driver?: string;
      provider?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "EnvironmentRunError";
    this.code = code;
    this.environmentId = details?.environmentId;
    this.driver = details?.driver;
    this.provider = details?.provider;
    this.cause = details?.cause;
  }
}

export interface EnvironmentAcquisitionResult {
  environment: Environment;
  lease: EnvironmentLease;
  leaseContext: ReturnType<typeof buildEnvironmentLeaseContext>;
  executionTransport: ReturnType<typeof adapterExecutionTargetToRemoteSpec>;
}

export interface EnvironmentRealizationResult {
  lease: EnvironmentLease;
  workspaceRealization: Record<string, unknown>;
  executionTarget: AdapterExecutionTarget | null;
  remoteExecution: ReturnType<typeof adapterExecutionTargetToRemoteSpec>;
  persistedExecutionWorkspace: ExecutionWorkspace | null;
}

export interface EnvironmentReleaseResult {
  released: EnvironmentRuntimeLeaseRecord[];
  errors: Array<{ leaseId: string; error: unknown }>;
}

function firstNonEmptyLine(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line) return line;
  }
  return null;
}

function formatProvisionFailureDetail(result: {
  exitCode: number | null;
  signal?: string | null;
  timedOut?: boolean | null;
  stdout: string;
  stderr: string;
}): string {
  if (result.timedOut) {
    return "provision command timed out";
  }
  const signal = typeof result.signal === "string" && result.signal.trim().length > 0
    ? ` (signal ${result.signal.trim()})`
    : "";
  const detail = firstNonEmptyLine(result.stderr) ?? firstNonEmptyLine(result.stdout);
  const status = `exit code ${result.exitCode ?? "null"}${signal}`;
  return detail ? `${status}: ${detail}` : status;
}

export function environmentRunOrchestrator(
  db: Db,
  options: {
    environmentRuntime?: EnvironmentRuntimeService;
  } = {},
) {
  const environmentsSvc = environmentService(db);
  const executionWorkspacesSvc = executionWorkspaceService(db);
  const environmentRuntime = options.environmentRuntime ?? environmentRuntimeService(db);

  async function resolveEnvironment(input: {
    companyId: string;
    selectedEnvironmentId: string | null | undefined;
    defaultEnvironmentId?: string | null;
  }): Promise<Environment> {
    const environmentId = input.selectedEnvironmentId || input.defaultEnvironmentId || "";
    const environment = environmentId
      ? await environmentsSvc.getById(environmentId)
      : await environmentsSvc.ensureLocalEnvironment(input.companyId);

    if (!environment) {
      throw new EnvironmentRunError("environment_not_found", `Environment "${environmentId}" not found.`, {
        environmentId,
      });
    }

    if (environment.companyId !== input.companyId) {
      throw new EnvironmentRunError("environment_not_found", `Environment "${environment.id}" does not belong to this company.`, {
        environmentId: environment.id,
        driver: environment.driver,
      });
    }

    if (environment.status !== "active") {
      throw new EnvironmentRunError("environment_inactive", `Environment "${environment.name}" is not active (status: ${environment.status}).`, {
        environmentId: environment.id,
        driver: environment.driver,
      });
    }

    return environment;
  }

  async function acquireLease(input: {
    companyId: string;
    environment: Environment;
    issueId: string | null;
    heartbeatRunId: string;
    persistedExecutionWorkspace: Pick<ExecutionWorkspace, "id" | "mode"> | null;
  }): Promise<EnvironmentRuntimeLeaseRecord> {
    try {
      return await environmentRuntime.acquireRunLease(input);
    } catch (err) {
      throw new EnvironmentRunError(
        "lease_acquire_failed",
        `Failed to acquire lease for environment "${input.environment.name}" (${input.environment.driver}): ${err instanceof Error ? err.message : String(err)}`,
        {
          environmentId: input.environment.id,
          driver: input.environment.driver,
          cause: err,
        },
      );
    }
  }

  async function resolveTransport(input: {
    companyId: string;
    adapterType: string;
    environment: Environment;
    leaseMetadata: Record<string, unknown> | null;
  }): Promise<ReturnType<typeof adapterExecutionTargetToRemoteSpec>> {
    try {
      return await resolveEnvironmentExecutionTransport({
        db,
        companyId: input.companyId,
        adapterType: input.adapterType,
        environment: input.environment,
        leaseMetadata: input.leaseMetadata,
      });
    } catch (err) {
      throw new EnvironmentRunError(
        "transport_resolution_failed",
        `Failed to resolve execution transport for "${input.environment.name}": ${err instanceof Error ? err.message : String(err)}`,
        {
          environmentId: input.environment.id,
          driver: input.environment.driver,
          cause: err,
        },
      );
    }
  }

  async function acquireForRun(input: {
    companyId: string;
    selectedEnvironmentId: string | null | undefined;
    defaultEnvironmentId?: string | null;
    adapterType: string;
    issueId: string | null;
    heartbeatRunId: string;
    agentId: string;
    persistedExecutionWorkspace: Pick<ExecutionWorkspace, "id" | "mode"> | null;
  }): Promise<EnvironmentAcquisitionResult> {
    const environment = await resolveEnvironment({
      companyId: input.companyId,
      selectedEnvironmentId: input.selectedEnvironmentId,
      defaultEnvironmentId: input.defaultEnvironmentId,
    });
    const leaseRecord = await acquireLease({
      companyId: input.companyId,
      environment,
      issueId: input.issueId,
      heartbeatRunId: input.heartbeatRunId,
      persistedExecutionWorkspace: input.persistedExecutionWorkspace,
    });

    await logActivity(db, {
      companyId: input.companyId,
      actorType: "agent",
      actorId: input.agentId,
      agentId: input.agentId,
      runId: input.heartbeatRunId,
      action: "environment.lease_acquired",
      entityType: "environment_lease",
      entityId: leaseRecord.lease.id,
      details: {
        environmentId: environment.id,
        driver: environment.driver,
        leasePolicy: leaseRecord.lease.leasePolicy,
        provider: leaseRecord.lease.provider,
        executionWorkspaceId: leaseRecord.leaseContext.executionWorkspaceId,
        issueId: input.issueId,
      },
    }).catch(() => undefined);

    const executionTransport = await resolveTransport({
      companyId: input.companyId,
      adapterType: input.adapterType,
      environment,
      leaseMetadata: leaseRecord.lease.metadata,
    });

    return {
      environment,
      lease: leaseRecord.lease,
      leaseContext: leaseRecord.leaseContext,
      executionTransport,
    };
  }

  async function realizeForRun(input: {
    environment: Environment;
    lease: EnvironmentLease;
    adapterType: string;
    companyId: string;
    issueId: string | null;
    heartbeatRunId: string;
    executionWorkspace: RealizedExecutionWorkspace;
    effectiveExecutionWorkspaceMode: string | null;
    persistedExecutionWorkspace: ExecutionWorkspace | null;
  }): Promise<EnvironmentRealizationResult> {
    let { lease, persistedExecutionWorkspace } = input;
    const workspaceRealizationRequest = buildWorkspaceRealizationRequest({
      adapterType: input.adapterType,
      companyId: input.companyId,
      environmentId: input.environment.id,
      executionWorkspaceId: persistedExecutionWorkspace?.id ?? null,
      issueId: input.issueId,
      heartbeatRunId: input.heartbeatRunId,
      requestedMode: persistedExecutionWorkspace?.mode ?? input.effectiveExecutionWorkspaceMode,
      workspace: input.executionWorkspace,
      workspaceConfig: persistedExecutionWorkspace?.config ?? null,
    });

    let workspaceRealization: Record<string, unknown> = {};
    let realizedWorkspaceCwd: string | null = null;
    try {
      const remoteCwd =
        typeof lease.metadata?.remoteCwd === "string" && lease.metadata.remoteCwd.trim().length > 0
          ? lease.metadata.remoteCwd
          : undefined;
      const workspaceRealizationResult = await environmentRuntime.realizeWorkspace({
        environment: input.environment,
        lease,
        workspace: {
          localPath: input.executionWorkspace.cwd,
          remotePath: remoteCwd,
          mode: persistedExecutionWorkspace?.mode ?? input.effectiveExecutionWorkspaceMode ?? undefined,
          metadata: {
            workspaceRealizationRequest,
          },
        },
      });
      realizedWorkspaceCwd =
        typeof workspaceRealizationResult.cwd === "string" && workspaceRealizationResult.cwd.trim().length > 0
          ? workspaceRealizationResult.cwd.trim()
          : null;
      workspaceRealization = parseObject(workspaceRealizationResult.metadata?.workspaceRealization);
    } catch (err) {
      throw new EnvironmentRunError(
        "workspace_realization_failed",
        `Failed to realize workspace for environment "${input.environment.name}" (${input.environment.driver}): ${err instanceof Error ? err.message : String(err)}`,
        {
          environmentId: input.environment.id,
          driver: input.environment.driver,
          cause: err,
        },
      );
    }

    const provisionCommand = workspaceRealizationRequest.runtimeOverlay.provisionCommand?.trim() ?? "";
    const realizedCwd =
      realizedWorkspaceCwd ??
      (typeof lease.metadata?.remoteCwd === "string" && lease.metadata.remoteCwd.trim().length > 0
        ? lease.metadata.remoteCwd.trim()
        : input.executionWorkspace.cwd);
    if (provisionCommand && input.environment.driver !== "local") {
      try {
        const provisionResult = await environmentRuntime.execute({
          environment: input.environment,
          lease,
          command: "bash",
          args: ["-lc", provisionCommand],
          cwd: realizedCwd,
          env: {
            SHELL: "/bin/bash",
          },
          timeoutMs: 300_000,
        });
        if (provisionResult.exitCode !== 0 || provisionResult.timedOut) {
          throw new Error(formatProvisionFailureDetail(provisionResult));
        }
      } catch (err) {
        throw new EnvironmentRunError(
          "workspace_realization_failed",
          `Failed to provision workspace for environment "${input.environment.name}" (${input.environment.driver}): ${err instanceof Error ? err.message : String(err)}`,
          {
            environmentId: input.environment.id,
            driver: input.environment.driver,
            cause: err,
          },
        );
      }
    }

    if (Object.keys(workspaceRealization).length > 0) {
      const nextLeaseMetadata = {
        ...(lease.metadata ?? {}),
        workspaceRealization,
      };
      const updatedLease = await environmentsSvc.updateLeaseMetadata(lease.id, nextLeaseMetadata);
      if (updatedLease) lease = updatedLease;
      if (persistedExecutionWorkspace) {
        const updatedWorkspace = await executionWorkspacesSvc.update(persistedExecutionWorkspace.id, {
          metadata: {
            ...(persistedExecutionWorkspace.metadata ?? {}),
            workspaceRealizationRequest,
            workspaceRealization,
          },
        });
        if (updatedWorkspace) persistedExecutionWorkspace = updatedWorkspace;
      }
    }

    let executionTarget: AdapterExecutionTarget | null;
    try {
      executionTarget = await resolveEnvironmentExecutionTarget({
        db,
        companyId: input.companyId,
        adapterType: input.adapterType,
        environment: input.environment,
        leaseId: lease.id,
        leaseMetadata: lease.metadata,
        lease,
        environmentRuntime,
      });
    } catch (err) {
      throw new EnvironmentRunError(
        "transport_resolution_failed",
        `Failed to resolve execution target for "${input.environment.name}": ${err instanceof Error ? err.message : String(err)}`,
        {
          environmentId: input.environment.id,
          driver: input.environment.driver,
          cause: err,
        },
      );
    }

    return {
      lease,
      workspaceRealization,
      executionTarget,
      remoteExecution: adapterExecutionTargetToRemoteSpec(executionTarget),
      persistedExecutionWorkspace,
    };
  }

  async function releaseForRun(input: {
    heartbeatRunId: string;
    companyId: string;
    agentId: string;
    status?: Extract<EnvironmentLeaseStatus, "released" | "expired" | "failed">;
    failureReason?: string;
  }): Promise<EnvironmentReleaseResult> {
    const status = input.status ?? "released";
    const result: EnvironmentReleaseResult = { released: [], errors: [] };

    let releasedLeases: EnvironmentRuntimeLeaseRecord[];
    try {
      releasedLeases = await environmentRuntime.releaseRunLeases(input.heartbeatRunId, status);
    } catch (err) {
      result.errors.push({ leaseId: "*", error: err });
      return result;
    }

    for (const released of releasedLeases) {
      await logActivity(db, {
        companyId: input.companyId,
        actorType: "agent",
        actorId: input.agentId,
        agentId: input.agentId,
        runId: input.heartbeatRunId,
        action: "environment.lease_released",
        entityType: "environment_lease",
        entityId: released.lease.id,
        details: {
          environmentId: released.lease.environmentId,
          driver: released.environment.driver,
          leasePolicy: released.lease.leasePolicy,
          provider: released.lease.provider,
          executionWorkspaceId: released.lease.executionWorkspaceId,
          issueId: released.lease.issueId,
          status: released.lease.status,
          cleanupStatus: released.lease.cleanupStatus,
          failureReason: input.failureReason ?? released.lease.failureReason,
        },
      }).catch(() => undefined);
      result.released.push(released);
    }

    return result;
  }

  return {
    resolveEnvironment,
    acquireLease,
    resolveTransport,
    acquireForRun,
    realizeForRun,
    releaseForRun,
    runtime: environmentRuntime,
  };
}

export type EnvironmentRunOrchestrator = ReturnType<typeof environmentRunOrchestrator>;
