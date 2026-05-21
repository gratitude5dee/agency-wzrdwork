export interface SnapshotDashboard {
  agentsOnline: number;
  runsActive: number;
  openIssues: number;
  pendingApprovals: number;
  monthSpendUsd: number;
  monthBudgetUsd: number;
  budgetUtilization: number;
}

export interface SnapshotCostBucket {
  tokensIn: number;
  tokensOut: number;
  cached: number;
  usd: number;
}

export interface SnapshotBudgetPolicy {
  id: string;
  scopeType: string;
  scopeId: string;
  metric: string;
  windowKind: string;
  amount: number;
  warnPercent: number;
  hardStopEnabled: boolean;
  notifyEnabled: boolean;
  isActive: boolean;
  amountUsed: number;
  utilization: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotBudgetIncident {
  id: string;
  policyId: string;
  scopeType: string;
  scopeId: string;
  metric: string;
  thresholdType: string;
  amountLimit: number;
  amountObserved: number;
  status: string;
  approvalId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface SnapshotHeartbeatAgent {
  lastTickAt: string | null;
  lastStatus: string | null;
  runIds: string[];
}

export interface SnapshotHeartbeatEvent {
  id: number;
  runId: string;
  agentId: string;
  eventType: string;
  stream: string | null;
  level: string | null;
  message: string | null;
  createdAt: string;
}

export interface SnapshotDocument {
  id: string;
  issueId: string | null;
  key: string | null;
  title: string | null;
  format: string;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  updatedByAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotWorkProduct {
  id: string;
  projectId: string | null;
  issueId: string;
  executionWorkspaceId: string | null;
  runtimeServiceId: string | null;
  type: string;
  provider: string;
  externalId: string | null;
  title: string;
  url: string | null;
  status: string;
  reviewState: string;
  isPrimary: boolean;
  healthStatus: string;
  summary: string | null;
  createdByRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotAttachment {
  id: string;
  issueId: string;
  assetId: string;
  filename: string | null;
  contentType: string | null;
  byteSize: number | null;
  createdAt: string;
}

export interface SnapshotExecutionWorkspace {
  id: string;
  projectId: string;
  sourceIssueId: string | null;
  mode: string;
  strategyType: string;
  name: string;
  status: string;
  cwd: string | null;
  repoUrl: string | null;
  branchName: string | null;
  providerType: string;
  providerRef: string | null;
  lastUsedAt: string;
  openedAt: string;
  closedAt: string | null;
}

export interface SnapshotRuntimeService {
  id: string;
  projectId: string | null;
  executionWorkspaceId: string | null;
  issueId: string | null;
  serviceName: string;
  status: string;
  lifecycle: string;
  port: number | null;
  url: string | null;
  provider: string;
  ownerAgentId: string | null;
  startedByRunId: string | null;
  healthStatus: string;
  lastUsedAt: string;
  startedAt: string;
  stoppedAt: string | null;
}

export interface SnapshotPlugin {
  id: string;
  pluginKey: string;
  packageName: string;
  version: string;
  status: string;
  categories: string[];
  lastError: string | null;
  updatedAt: string;
}

export interface SnapshotRoutineNext {
  id: string;
  title: string;
  assigneeAgentId: string;
  status: string;
  triggerKind: string | null;
  triggerLabel: string | null;
  nextRunAt: string | null;
  lastTriggeredAt: string | null;
}

export interface SnapshotRoutineRun {
  id: string;
  routineId: string;
  triggerId: string | null;
  source: string;
  status: string;
  linkedIssueId: string | null;
  triggeredAt: string;
  completedAt: string | null;
  failureReason: string | null;
}

export interface SnapshotSecrets {
  count: number;
  providers: string[];
  lastRotatedAt: string | null;
}

export interface SnapshotIssueRelation {
  id: string;
  issueId: string;
  relatedIssueId: string;
  type: "blocks" | string;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotIssueThreadInteraction {
  id: string;
  issueId: string;
  kind: string;
  status: string;
  continuationPolicy: string;
  sourceCommentId: string | null;
  sourceRunId: string | null;
  title: string | null;
  summary: string | null;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  resolvedByAgentId: string | null;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotIssueExecutionDecision {
  id: string;
  issueId: string;
  stageId: string;
  stageType: string;
  actorAgentId: string | null;
  actorUserId: string | null;
  outcome: string;
  body: string;
  createdByRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotEnvironment {
  id: string;
  name: string;
  description: string | null;
  driver: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotEnvironmentLease {
  id: string;
  environmentId: string;
  executionWorkspaceId: string | null;
  issueId: string | null;
  heartbeatRunId: string | null;
  status: string;
  leasePolicy: string;
  provider: string | null;
  acquiredAt: string;
  lastUsedAt: string;
  expiresAt: string | null;
  releasedAt: string | null;
  failureReason: string | null;
  cleanupStatus: string | null;
}

export interface SnapshotPluginManagedResource {
  id: string;
  pluginId: string;
  pluginKey: string;
  resourceKind: string;
  resourceKey: string;
  resourceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotCompanySecretBinding {
  id: string;
  secretId: string;
  targetType: string;
  targetId: string;
  configPath: string;
  versionSelector: string;
  required: boolean;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotSecretAccessEvent {
  id: string;
  secretId: string;
  version: number | null;
  provider: string;
  actorType: string;
  actorId: string | null;
  consumerType: string;
  consumerId: string;
  configPath: string | null;
  issueId: string | null;
  heartbeatRunId: string | null;
  pluginId: string | null;
  outcome: string;
  errorCode: string | null;
  createdAt: string;
}

export interface AgencySnapshotControlPlane {
  dashboard: SnapshotDashboard;
  costs: {
    byAgent: Record<string, SnapshotCostBucket>;
    byProject: Record<string, SnapshotCostBucket>;
    total: SnapshotCostBucket;
  };
  budgets: {
    company: SnapshotBudgetPolicy | null;
    perAgent: Record<string, SnapshotBudgetPolicy>;
    incidents: SnapshotBudgetIncident[];
  };
  heartbeats: {
    byAgent: Record<string, SnapshotHeartbeatAgent>;
    recentEvents: SnapshotHeartbeatEvent[];
  };
  runtimeState: {
    byAgent: Record<string, {
      agentId: string;
      phase: string | null;
      sessionId: string | null;
      lastRunId: string | null;
      lastRunStatus: string | null;
      lastError: string | null;
      lastHeartbeatAt: string | null;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCachedInputTokens: number;
      totalCostUsd: number;
    }>;
  };
  documents: SnapshotDocument[];
  workProducts: SnapshotWorkProduct[];
  attachments: SnapshotAttachment[];
  executionWorkspaces: SnapshotExecutionWorkspace[];
  runtimeServices: SnapshotRuntimeService[];
  plugins: {
    installed: SnapshotPlugin[];
    activeJobs: number;
    failingJobs: number;
  };
  routines: {
    upcoming: SnapshotRoutineNext[];
    recentRuns: SnapshotRoutineRun[];
  };
  secrets: SnapshotSecrets;
  issueRelations: SnapshotIssueRelation[];
  issueThreadInteractions: SnapshotIssueThreadInteraction[];
  issueExecutionDecisions: SnapshotIssueExecutionDecision[];
  environments: SnapshotEnvironment[];
  environmentLeases: SnapshotEnvironmentLease[];
  pluginManagedResources: SnapshotPluginManagedResource[];
  secretBindings: SnapshotCompanySecretBinding[];
  secretAccessEvents: SnapshotSecretAccessEvent[];
}
