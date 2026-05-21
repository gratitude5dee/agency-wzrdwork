export type AgentStatus =
  | "active"
  | "idle"
  | "running"
  | "paused"
  | "error"
  | "pending_approval"
  | "terminated";

export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "done"
  | "cancelled";

export type IssuePriority = "critical" | "high" | "medium" | "low";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "revision_requested";

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "timed_out" | "cancelled";

export type GoalStatus = "planned" | "active" | "complete" | "at_risk";

export type ProjectStatus = "planned" | "active" | "paused" | "done";

export interface CompanyRecord {
  id: string;
  slug: string;
  name: string;
  companyType: string;
  description: string;
  brief: string;
  brandColor: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRecord {
  id: string;
  companyId: string;
  name: string;
  role: string;
  title: string | null;
  adapterType: string;
  status: AgentStatus;
  capabilities: string | null;
  reportsTo: string | null;
  seatIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  companyId: string;
  name: string;
  summary: string;
  status: ProjectStatus;
  priority: IssuePriority;
  createdAt: string;
  updatedAt: string;
}

export interface GoalRecord {
  id: string;
  companyId: string;
  title: string;
  summary: string;
  status: GoalStatus;
  ownerAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueRecord {
  id: string;
  companyId: string;
  projectId: string | null;
  assigneeAgentId: string | null;
  identifier: string | null;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  companyId: string;
  issueId: string | null;
  requestedByAgentId: string | null;
  status: ApprovalStatus;
  summary: string;
  details?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface RunRecord {
  id: string;
  companyId: string;
  issueId: string | null;
  agentId: string;
  status: RunStatus;
  summary: string | null;
  stdoutExcerpt: string | null;
  stderrExcerpt: string | null;
  error: string | null;
  totalInputTokens: number | null;
  totalOutputTokens: number | null;
  totalCachedInputTokens: number | null;
  totalCostUsd: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface ActivityRecord {
  id: string;
  companyId: string;
  agentId: string | null;
  issueId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
}

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

export interface SnapshotCosts {
  byAgent: Record<string, SnapshotCostBucket>;
  byProject: Record<string, SnapshotCostBucket>;
  total: SnapshotCostBucket;
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

export interface SnapshotBudgets {
  company: SnapshotBudgetPolicy | null;
  perAgent: Record<string, SnapshotBudgetPolicy>;
  incidents: SnapshotBudgetIncident[];
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

export interface SnapshotHeartbeats {
  byAgent: Record<string, SnapshotHeartbeatAgent>;
  recentEvents: SnapshotHeartbeatEvent[];
}

export interface SnapshotRuntimeState {
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

export interface SnapshotPlugins {
  installed: SnapshotPlugin[];
  activeJobs: number;
  failingJobs: number;
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

export interface SnapshotRoutines {
  upcoming: SnapshotRoutineNext[];
  recentRuns: SnapshotRoutineRun[];
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

export interface AgencySnapshot {
  company: CompanyRecord;
  agents: AgentRecord[];
  projects: ProjectRecord[];
  goals: GoalRecord[];
  issues: IssueRecord[];
  approvals: ApprovalRecord[];
  runs: RunRecord[];
  activity: ActivityRecord[];
  dashboard: SnapshotDashboard;
  costs: SnapshotCosts;
  budgets: SnapshotBudgets;
  heartbeats: SnapshotHeartbeats;
  runtimeState: { byAgent: Record<string, SnapshotRuntimeState> };
  documents: SnapshotDocument[];
  workProducts: SnapshotWorkProduct[];
  attachments: SnapshotAttachment[];
  executionWorkspaces: SnapshotExecutionWorkspace[];
  runtimeServices: SnapshotRuntimeService[];
  plugins: SnapshotPlugins;
  routines: SnapshotRoutines;
  secrets: SnapshotSecrets;
  issueRelations: SnapshotIssueRelation[];
  issueThreadInteractions: SnapshotIssueThreadInteraction[];
  issueExecutionDecisions: SnapshotIssueExecutionDecision[];
  environments: SnapshotEnvironment[];
  environmentLeases: SnapshotEnvironmentLease[];
  pluginManagedResources: SnapshotPluginManagedResource[];
  secretBindings: SnapshotCompanySecretBinding[];
  secretAccessEvents: SnapshotSecretAccessEvent[];
  source: "server" | "demo";
  sourceMessage?: string;
}

export interface CreateIssueInput {
  title: string;
  description: string;
  assigneeAgentId: string | null;
  projectId: string | null;
  priority: IssuePriority;
}

type PaperclipSnapshotSections = Pick<
  AgencySnapshot,
  | "dashboard"
  | "costs"
  | "budgets"
  | "heartbeats"
  | "runtimeState"
  | "documents"
  | "workProducts"
  | "attachments"
  | "executionWorkspaces"
  | "runtimeServices"
  | "plugins"
  | "routines"
  | "secrets"
  | "issueRelations"
  | "issueThreadInteractions"
  | "issueExecutionDecisions"
  | "environments"
  | "environmentLeases"
  | "pluginManagedResources"
  | "secretBindings"
  | "secretAccessEvents"
>;

export function createEmptyPaperclipSnapshotSections(): PaperclipSnapshotSections {
  return {
    dashboard: {
      agentsOnline: 0,
      runsActive: 0,
      openIssues: 0,
      pendingApprovals: 0,
      monthSpendUsd: 0,
      monthBudgetUsd: 0,
      budgetUtilization: 0,
    },
    costs: {
      byAgent: {},
      byProject: {},
      total: { tokensIn: 0, tokensOut: 0, cached: 0, usd: 0 },
    },
    budgets: {
      company: null,
      perAgent: {},
      incidents: [],
    },
    heartbeats: {
      byAgent: {},
      recentEvents: [],
    },
    runtimeState: {
      byAgent: {},
    },
    documents: [],
    workProducts: [],
    attachments: [],
    executionWorkspaces: [],
    runtimeServices: [],
    plugins: {
      installed: [],
      activeJobs: 0,
      failingJobs: 0,
    },
    routines: {
      upcoming: [],
      recentRuns: [],
    },
    secrets: {
      count: 0,
      providers: [],
      lastRotatedAt: null,
    },
    issueRelations: [],
    issueThreadInteractions: [],
    issueExecutionDecisions: [],
    environments: [],
    environmentLeases: [],
    pluginManagedResources: [],
    secretBindings: [],
    secretAccessEvents: [],
  };
}
