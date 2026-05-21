import { z } from "zod";

const nullableString = z.string().nullable();

export const snapshotDashboardSchema = z.object({
  agentsOnline: z.number().int().nonnegative(),
  runsActive: z.number().int().nonnegative(),
  openIssues: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  monthSpendUsd: z.number().nonnegative(),
  monthBudgetUsd: z.number().nonnegative(),
  budgetUtilization: z.number().nonnegative(),
});

export const snapshotCostBucketSchema = z.object({
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  cached: z.number().int().nonnegative(),
  usd: z.number().nonnegative(),
});

export const snapshotBudgetPolicySchema = z.object({
  id: z.string(),
  scopeType: z.string(),
  scopeId: z.string(),
  metric: z.string(),
  windowKind: z.string(),
  amount: z.number().nonnegative(),
  warnPercent: z.number().nonnegative(),
  hardStopEnabled: z.boolean(),
  notifyEnabled: z.boolean(),
  isActive: z.boolean(),
  amountUsed: z.number().nonnegative(),
  utilization: z.number().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotBudgetIncidentSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  scopeType: z.string(),
  scopeId: z.string(),
  metric: z.string(),
  thresholdType: z.string(),
  amountLimit: z.number().nonnegative(),
  amountObserved: z.number().nonnegative(),
  status: z.string(),
  approvalId: nullableString,
  createdAt: z.string(),
  resolvedAt: nullableString,
});

export const snapshotHeartbeatAgentSchema = z.object({
  lastTickAt: nullableString,
  lastStatus: nullableString,
  runIds: z.array(z.string()),
});

export const snapshotHeartbeatEventSchema = z.object({
  id: z.number(),
  runId: z.string(),
  agentId: z.string(),
  eventType: z.string(),
  stream: nullableString,
  level: nullableString,
  message: nullableString,
  createdAt: z.string(),
});

export const snapshotRuntimeStateSchema = z.object({
  agentId: z.string(),
  phase: nullableString,
  sessionId: nullableString,
  lastRunId: nullableString,
  lastRunStatus: nullableString,
  lastError: nullableString,
  lastHeartbeatAt: nullableString,
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCachedInputTokens: z.number().int().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
});

export const snapshotDocumentSchema = z.object({
  id: z.string(),
  issueId: nullableString,
  key: nullableString,
  title: nullableString,
  format: z.string(),
  latestRevisionNumber: z.number().int().nonnegative(),
  createdByAgentId: nullableString,
  updatedByAgentId: nullableString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotWorkProductSchema = z.object({
  id: z.string(),
  projectId: nullableString,
  issueId: z.string(),
  executionWorkspaceId: nullableString,
  runtimeServiceId: nullableString,
  type: z.string(),
  provider: z.string(),
  externalId: nullableString,
  title: z.string(),
  url: nullableString,
  status: z.string(),
  reviewState: z.string(),
  isPrimary: z.boolean(),
  healthStatus: z.string(),
  summary: nullableString,
  createdByRunId: nullableString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotAttachmentSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  assetId: z.string(),
  filename: nullableString,
  contentType: nullableString,
  byteSize: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
});

export const snapshotExecutionWorkspaceSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceIssueId: nullableString,
  mode: z.string(),
  strategyType: z.string(),
  name: z.string(),
  status: z.string(),
  cwd: nullableString,
  repoUrl: nullableString,
  branchName: nullableString,
  providerType: z.string(),
  providerRef: nullableString,
  lastUsedAt: z.string(),
  openedAt: z.string(),
  closedAt: nullableString,
});

export const snapshotRuntimeServiceSchema = z.object({
  id: z.string(),
  projectId: nullableString,
  executionWorkspaceId: nullableString,
  issueId: nullableString,
  serviceName: z.string(),
  status: z.string(),
  lifecycle: z.string(),
  port: z.number().int().nullable(),
  url: nullableString,
  provider: z.string(),
  ownerAgentId: nullableString,
  startedByRunId: nullableString,
  healthStatus: z.string(),
  lastUsedAt: z.string(),
  startedAt: z.string(),
  stoppedAt: nullableString,
});

export const snapshotPluginSchema = z.object({
  id: z.string(),
  pluginKey: z.string(),
  packageName: z.string(),
  version: z.string(),
  status: z.string(),
  categories: z.array(z.string()),
  lastError: nullableString,
  updatedAt: z.string(),
});

export const snapshotRoutineNextSchema = z.object({
  id: z.string(),
  title: z.string(),
  assigneeAgentId: z.string(),
  status: z.string(),
  triggerKind: nullableString,
  triggerLabel: nullableString,
  nextRunAt: nullableString,
  lastTriggeredAt: nullableString,
});

export const snapshotRoutineRunSchema = z.object({
  id: z.string(),
  routineId: z.string(),
  triggerId: nullableString,
  source: z.string(),
  status: z.string(),
  linkedIssueId: nullableString,
  triggeredAt: z.string(),
  completedAt: nullableString,
  failureReason: nullableString,
});

export const snapshotSecretsSchema = z.object({
  count: z.number().int().nonnegative(),
  providers: z.array(z.string()),
  lastRotatedAt: nullableString,
});

export const snapshotIssueRelationSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  relatedIssueId: z.string(),
  type: z.string(),
  createdByAgentId: nullableString,
  createdByUserId: nullableString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotIssueThreadInteractionSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  kind: z.string(),
  status: z.string(),
  continuationPolicy: z.string(),
  sourceCommentId: nullableString,
  sourceRunId: nullableString,
  title: nullableString,
  summary: nullableString,
  createdByAgentId: nullableString,
  createdByUserId: nullableString,
  resolvedByAgentId: nullableString,
  resolvedByUserId: nullableString,
  resolvedAt: nullableString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotIssueExecutionDecisionSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  stageId: z.string(),
  stageType: z.string(),
  actorAgentId: nullableString,
  actorUserId: nullableString,
  outcome: z.string(),
  body: z.string(),
  createdByRunId: nullableString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotEnvironmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: nullableString,
  driver: z.string(),
  status: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotEnvironmentLeaseSchema = z.object({
  id: z.string(),
  environmentId: z.string(),
  executionWorkspaceId: nullableString,
  issueId: nullableString,
  heartbeatRunId: nullableString,
  status: z.string(),
  leasePolicy: z.string(),
  provider: nullableString,
  acquiredAt: z.string(),
  lastUsedAt: z.string(),
  expiresAt: nullableString,
  releasedAt: nullableString,
  failureReason: nullableString,
  cleanupStatus: nullableString,
});

export const snapshotPluginManagedResourceSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  pluginKey: z.string(),
  resourceKind: z.string(),
  resourceKey: z.string(),
  resourceId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotCompanySecretBindingSchema = z.object({
  id: z.string(),
  secretId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  configPath: z.string(),
  versionSelector: z.string(),
  required: z.boolean(),
  label: nullableString,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const snapshotSecretAccessEventSchema = z.object({
  id: z.string(),
  secretId: z.string(),
  version: z.number().int().nullable(),
  provider: z.string(),
  actorType: z.string(),
  actorId: nullableString,
  consumerType: z.string(),
  consumerId: z.string(),
  configPath: nullableString,
  issueId: nullableString,
  heartbeatRunId: nullableString,
  pluginId: nullableString,
  outcome: z.string(),
  errorCode: nullableString,
  createdAt: z.string(),
});

export const agencySnapshotControlPlaneSchema = z.object({
  dashboard: snapshotDashboardSchema,
  costs: z.object({
    byAgent: z.record(snapshotCostBucketSchema),
    byProject: z.record(snapshotCostBucketSchema),
    total: snapshotCostBucketSchema,
  }),
  budgets: z.object({
    company: snapshotBudgetPolicySchema.nullable(),
    perAgent: z.record(snapshotBudgetPolicySchema),
    incidents: z.array(snapshotBudgetIncidentSchema),
  }),
  heartbeats: z.object({
    byAgent: z.record(snapshotHeartbeatAgentSchema),
    recentEvents: z.array(snapshotHeartbeatEventSchema),
  }),
  runtimeState: z.object({
    byAgent: z.record(snapshotRuntimeStateSchema),
  }),
  documents: z.array(snapshotDocumentSchema),
  workProducts: z.array(snapshotWorkProductSchema),
  attachments: z.array(snapshotAttachmentSchema),
  executionWorkspaces: z.array(snapshotExecutionWorkspaceSchema),
  runtimeServices: z.array(snapshotRuntimeServiceSchema),
  plugins: z.object({
    installed: z.array(snapshotPluginSchema),
    activeJobs: z.number().int().nonnegative(),
    failingJobs: z.number().int().nonnegative(),
  }),
  routines: z.object({
    upcoming: z.array(snapshotRoutineNextSchema),
    recentRuns: z.array(snapshotRoutineRunSchema),
  }),
  secrets: snapshotSecretsSchema,
  issueRelations: z.array(snapshotIssueRelationSchema),
  issueThreadInteractions: z.array(snapshotIssueThreadInteractionSchema),
  issueExecutionDecisions: z.array(snapshotIssueExecutionDecisionSchema),
  environments: z.array(snapshotEnvironmentSchema),
  environmentLeases: z.array(snapshotEnvironmentLeaseSchema),
  pluginManagedResources: z.array(snapshotPluginManagedResourceSchema),
  secretBindings: z.array(snapshotCompanySecretBindingSchema),
  secretAccessEvents: z.array(snapshotSecretAccessEventSchema),
}).passthrough();

export type AgencySnapshotControlPlaneInput = z.infer<typeof agencySnapshotControlPlaneSchema>;
