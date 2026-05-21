import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { executionWorkspaces } from "@paperclipai/db";
import type {
  ExecutionWorkspace,
  ExecutionWorkspaceConfig,
  WorkspaceRuntimeDesiredState,
} from "@paperclipai/shared";

type ExecutionWorkspaceRow = typeof executionWorkspaces.$inferSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cloneRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? { ...value } : null;
}

function readDesiredState(value: unknown): WorkspaceRuntimeDesiredState | null {
  return value === "running" || value === "stopped" || value === "manual" ? value : null;
}

function readServiceStates(value: unknown): ExecutionWorkspaceConfig["serviceStates"] {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value).filter(([, state]) =>
    state === "running" || state === "stopped" || state === "manual"
  );
  return entries.length > 0
    ? Object.fromEntries(entries) as ExecutionWorkspaceConfig["serviceStates"]
    : null;
}

export function readExecutionWorkspaceConfig(
  metadata: Record<string, unknown> | null | undefined,
): ExecutionWorkspaceConfig | null {
  const raw = isRecord(metadata?.config) ? metadata.config : null;
  if (!raw) return null;

  const config: ExecutionWorkspaceConfig = {
    environmentId: readNullableString(raw.environmentId),
    provisionCommand: readNullableString(raw.provisionCommand),
    teardownCommand: readNullableString(raw.teardownCommand),
    cleanupCommand: readNullableString(raw.cleanupCommand),
    workspaceRuntime: cloneRecord(raw.workspaceRuntime),
    desiredState: readDesiredState(raw.desiredState),
    serviceStates: readServiceStates(raw.serviceStates),
  };

  const hasConfig = Object.values(config).some((value) => {
    if (value === null) return false;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  });

  return hasConfig ? config : null;
}

export function mergeExecutionWorkspaceConfig(
  metadata: Record<string, unknown> | null | undefined,
  configPatch: Partial<ExecutionWorkspaceConfig>,
): Record<string, unknown> {
  return {
    ...(metadata ?? {}),
    config: {
      ...(readExecutionWorkspaceConfig(metadata) ?? {}),
      ...configPatch,
    },
  };
}

function toExecutionWorkspace(row: ExecutionWorkspaceRow): ExecutionWorkspace {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    projectWorkspaceId: row.projectWorkspaceId ?? null,
    sourceIssueId: row.sourceIssueId ?? null,
    mode: row.mode as ExecutionWorkspace["mode"],
    strategyType: row.strategyType as ExecutionWorkspace["strategyType"],
    name: row.name,
    status: row.status as ExecutionWorkspace["status"],
    cwd: row.cwd ?? null,
    repoUrl: row.repoUrl ?? null,
    baseRef: row.baseRef ?? null,
    branchName: row.branchName ?? null,
    providerType: row.providerType as ExecutionWorkspace["providerType"],
    providerRef: row.providerRef ?? null,
    derivedFromExecutionWorkspaceId: row.derivedFromExecutionWorkspaceId ?? null,
    lastUsedAt: row.lastUsedAt,
    openedAt: row.openedAt,
    closedAt: row.closedAt ?? null,
    cleanupEligibleAt: row.cleanupEligibleAt ?? null,
    cleanupReason: row.cleanupReason ?? null,
    config: readExecutionWorkspaceConfig((row.metadata as Record<string, unknown> | null) ?? null),
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function executionWorkspaceService(db: Db) {
  return {
    list: async (companyId: string, filters?: {
      projectId?: string;
      projectWorkspaceId?: string;
      issueId?: string;
      status?: string;
      reuseEligible?: boolean;
    }) => {
      const conditions = [eq(executionWorkspaces.companyId, companyId)];
      if (filters?.projectId) conditions.push(eq(executionWorkspaces.projectId, filters.projectId));
      if (filters?.projectWorkspaceId) {
        conditions.push(eq(executionWorkspaces.projectWorkspaceId, filters.projectWorkspaceId));
      }
      if (filters?.issueId) conditions.push(eq(executionWorkspaces.sourceIssueId, filters.issueId));
      if (filters?.status) {
        const statuses = filters.status.split(",").map((value) => value.trim()).filter(Boolean);
        if (statuses.length === 1) conditions.push(eq(executionWorkspaces.status, statuses[0]!));
        else if (statuses.length > 1) conditions.push(inArray(executionWorkspaces.status, statuses));
      }
      if (filters?.reuseEligible) {
        conditions.push(inArray(executionWorkspaces.status, ["active", "idle", "in_review"]));
      }

      const rows = await db
        .select()
        .from(executionWorkspaces)
        .where(and(...conditions))
        .orderBy(desc(executionWorkspaces.lastUsedAt), desc(executionWorkspaces.createdAt));
      return rows.map(toExecutionWorkspace);
    },

    getById: async (id: string) => {
      const row = await db
        .select()
        .from(executionWorkspaces)
        .where(eq(executionWorkspaces.id, id))
        .then((rows) => rows[0] ?? null);
      return row ? toExecutionWorkspace(row) : null;
    },

    clearEnvironmentSelection: async (companyId: string, environmentId: string) => {
      return db.transaction(async (tx) => {
        const rows = await tx
          .select({
            id: executionWorkspaces.id,
            metadata: executionWorkspaces.metadata,
          })
          .from(executionWorkspaces)
          .where(eq(executionWorkspaces.companyId, companyId));

        let cleared = 0;
        for (const row of rows) {
          const config = readExecutionWorkspaceConfig(row.metadata);
          if (!config) continue;
          if (config.environmentId !== environmentId) continue;
          await tx
            .update(executionWorkspaces)
            .set({
              metadata: mergeExecutionWorkspaceConfig(row.metadata, { environmentId: null }),
              updatedAt: new Date(),
            })
            .where(eq(executionWorkspaces.id, row.id));
          cleared += 1;
        }
        return cleared;
      });
    },

    create: async (data: typeof executionWorkspaces.$inferInsert) => {
      const row = await db
        .insert(executionWorkspaces)
        .values(data)
        .returning()
        .then((rows) => rows[0] ?? null);
      return row ? toExecutionWorkspace(row) : null;
    },

    update: async (id: string, patch: Partial<typeof executionWorkspaces.$inferInsert>) => {
      const row = await db
        .update(executionWorkspaces)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(executionWorkspaces.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
      return row ? toExecutionWorkspace(row) : null;
    },
  };
}

export { toExecutionWorkspace };
