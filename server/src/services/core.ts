import type { Sql } from "postgres";
import { asString, HttpError } from "../http.js";

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  company_type: string | null;
  description: string | null;
  brief: string | null;
  brand_color: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentRow {
  id: string;
  company_id: string;
  name: string;
  role: string;
  title: string | null;
  adapter_type: string;
  status: string;
  capabilities: string | null;
  reports_to: string | null;
  seat_index: number;
  adapter_config?: Record<string, unknown> | null;
  private_cognition_enabled?: boolean;
  venice_model?: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  company_id: string;
  name: string;
  summary: string | null;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string;
}

interface GoalRow {
  id: string;
  company_id: string;
  title: string;
  summary: string | null;
  status: string;
  owner_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface IssueRow {
  id: string;
  company_id: string;
  project_id: string | null;
  assignee_agent_id: string | null;
  identifier: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface ApprovalRow {
  id: string;
  company_id: string;
  issue_id: string | null;
  requested_by_agent_id: string | null;
  status: string;
  summary: string;
  details: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface RunRow {
  id: string;
  company_id: string;
  issue_id: string | null;
  agent_id: string;
  status: string;
  summary: string | null;
  stdout_excerpt: string | null;
  stderr_excerpt: string | null;
  error: string | null;
  total_input_tokens: number | null;
  total_output_tokens: number | null;
  total_cached_input_tokens: number | null;
  total_cost_usd: number | null;
  created_at: string;
  finished_at: string | null;
}

interface ActivityRow {
  id: string;
  company_id: string;
  agent_id: string | null;
  issue_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

interface CostAggregateRow {
  scope_id: string | null;
  input_tokens: number | string | null;
  output_tokens: number | string | null;
  cached_input_tokens: number | string | null;
  cost_cents: number | string | null;
}

interface BudgetPolicyRow {
  id: string;
  company_id: string;
  scope_type: string;
  scope_id: string;
  metric: string;
  window_kind: string;
  amount: number | string;
  warn_percent: number | string;
  hard_stop_enabled: boolean;
  notify_enabled: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface BudgetIncidentRow {
  id: string;
  company_id: string;
  policy_id: string;
  scope_type: string;
  scope_id: string;
  metric: string;
  threshold_type: string;
  amount_limit: number | string;
  amount_observed: number | string;
  status: string;
  approval_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface HeartbeatRunRow {
  id: string;
  company_id: string;
  agent_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  session_id_after: string | null;
  stdout_excerpt: string | null;
  stderr_excerpt: string | null;
  created_at: string;
}

interface HeartbeatEventRow {
  id: number | string;
  company_id: string;
  run_id: string;
  agent_id: string;
  seq: number | string;
  event_type: string;
  stream: string | null;
  level: string | null;
  message: string | null;
  created_at: string;
}

interface AgentRuntimeStateRow {
  agent_id: string;
  company_id: string;
  session_id: string | null;
  last_run_id: string | null;
  last_run_status: string | null;
  total_input_tokens: number | string;
  total_output_tokens: number | string;
  total_cached_input_tokens: number | string;
  total_cost_cents: number | string;
  last_error: string | null;
  updated_at: string;
}

interface DocumentRow {
  id: string;
  issue_id: string | null;
  key: string | null;
  title: string | null;
  format: string;
  latest_revision_number: number | string;
  created_by_agent_id: string | null;
  updated_by_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkProductRow {
  id: string;
  project_id: string | null;
  issue_id: string;
  execution_workspace_id: string | null;
  runtime_service_id: string | null;
  type: string;
  provider: string;
  external_id: string | null;
  title: string;
  url: string | null;
  status: string;
  review_state: string;
  is_primary: boolean;
  health_status: string;
  summary: string | null;
  created_by_run_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AttachmentRow {
  id: string;
  issue_id: string;
  asset_id: string;
  filename: string | null;
  content_type: string | null;
  byte_size: number | string | null;
  created_at: string;
}

interface ExecutionWorkspaceRow {
  id: string;
  project_id: string;
  source_issue_id: string | null;
  mode: string;
  strategy_type: string;
  name: string;
  status: string;
  cwd: string | null;
  repo_url: string | null;
  branch_name: string | null;
  provider_type: string;
  provider_ref: string | null;
  last_used_at: string;
  opened_at: string;
  closed_at: string | null;
}

interface RuntimeServiceRow {
  id: string;
  project_id: string | null;
  execution_workspace_id: string | null;
  issue_id: string | null;
  service_name: string;
  status: string;
  lifecycle: string;
  port: number | string | null;
  url: string | null;
  provider: string;
  owner_agent_id: string | null;
  started_by_run_id: string | null;
  health_status: string;
  last_used_at: string;
  started_at: string;
  stopped_at: string | null;
}

interface PluginRow {
  id: string;
  plugin_key: string;
  package_name: string;
  version: string;
  categories: unknown;
  status: string;
  last_error: string | null;
  updated_at: string;
}

interface PluginJobCountRow {
  active_jobs: number | string | null;
  failing_jobs: number | string | null;
}

interface RoutineNextRow {
  id: string;
  title: string;
  assignee_agent_id: string;
  status: string;
  trigger_kind: string | null;
  trigger_label: string | null;
  next_run_at: string | null;
  last_triggered_at: string | null;
}

interface RoutineRunRow {
  id: string;
  routine_id: string;
  trigger_id: string | null;
  source: string;
  status: string;
  linked_issue_id: string | null;
  triggered_at: string;
  completed_at: string | null;
  failure_reason: string | null;
}

interface SecretAggregateRow {
  count: number | string | null;
  providers: unknown;
  last_rotated_at: string | null;
}

interface IssueRelationRow {
  id: string;
  company_id: string;
  issue_id: string;
  related_issue_id: string;
  type: string;
  created_by_agent_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface IssueThreadInteractionRow {
  id: string;
  company_id: string;
  issue_id: string;
  kind: string;
  status: string;
  continuation_policy: string;
  source_comment_id: string | null;
  source_run_id: string | null;
  title: string | null;
  summary: string | null;
  created_by_agent_id: string | null;
  created_by_user_id: string | null;
  resolved_by_agent_id: string | null;
  resolved_by_user_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface IssueExecutionDecisionRow {
  id: string;
  company_id: string;
  issue_id: string;
  stage_id: string;
  stage_type: string;
  actor_agent_id: string | null;
  actor_user_id: string | null;
  outcome: string;
  body: string;
  created_by_run_id: string | null;
  created_at: string;
  updated_at: string;
}

interface EnvironmentRow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  driver: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface EnvironmentLeaseRow {
  id: string;
  company_id: string;
  environment_id: string;
  execution_workspace_id: string | null;
  issue_id: string | null;
  heartbeat_run_id: string | null;
  status: string;
  lease_policy: string;
  provider: string | null;
  acquired_at: string;
  last_used_at: string;
  expires_at: string | null;
  released_at: string | null;
  failure_reason: string | null;
  cleanup_status: string | null;
}

interface PluginManagedResourceRow {
  id: string;
  company_id: string;
  plugin_id: string;
  plugin_key: string;
  resource_kind: string;
  resource_key: string;
  resource_id: string;
  created_at: string;
  updated_at: string;
}

interface CompanySecretBindingRow {
  id: string;
  company_id: string;
  secret_id: string;
  target_type: string;
  target_id: string;
  config_path: string;
  version_selector: string;
  required: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
}

interface SecretAccessEventRow {
  id: string;
  company_id: string;
  secret_id: string;
  version: number | string | null;
  provider: string;
  actor_type: string;
  actor_id: string | null;
  consumer_type: string;
  consumer_id: string;
  config_path: string | null;
  issue_id: string | null;
  heartbeat_run_id: string | null;
  plugin_id: string | null;
  outcome: string;
  error_code: string | null;
  created_at: string;
}

function isOptionalSnapshotRelationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "42P01" || code === "42703";
}

async function optionalRows<T>(loader: () => Promise<T[]>): Promise<T[]> {
  try {
    return await loader();
  } catch (error) {
    if (isOptionalSnapshotRelationError(error)) {
      return [];
    }
    throw error;
  }
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function roundUsd(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

function utilization(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.round((used / limit) * 1000) / 10;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function monthWindow(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

async function loadCompany(sql: Sql, companyId: string): Promise<CompanyRow> {
  const rows = await sql<CompanyRow[]>`
    SELECT
      id,
      slug,
      name,
      company_type,
      description,
      brief,
      brand_color,
      created_at,
      updated_at
    FROM public.companies
    WHERE id = ${companyId}::uuid
    LIMIT 1
  `;

  const company = rows[0];
  if (!company) {
    throw new HttpError(404, "Company not found");
  }
  return company;
}

function toCamelCompany(row: CompanyRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    companyType: row.company_type ?? "",
    description: row.description ?? "",
    brief: row.brief ?? "",
    brandColor: row.brand_color ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelAgent(row: AgentRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    role: row.role,
    title: row.title,
    adapterType: row.adapter_type,
    status: row.status,
    capabilities: row.capabilities,
    reportsTo: row.reports_to,
    seatIndex: row.seat_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelProject(row: ProjectRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    summary: row.summary ?? "",
    status: row.status,
    priority: (row.priority ?? "medium") as "critical" | "high" | "medium" | "low",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelGoal(row: GoalRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    summary: row.summary ?? "",
    status: row.status,
    ownerAgentId: row.owner_agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelIssue(row: IssueRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    assigneeAgentId: row.assignee_agent_id,
    identifier: row.identifier,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCamelApproval(row: ApprovalRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    issueId: row.issue_id,
    requestedByAgentId: row.requested_by_agent_id,
    status: row.status,
    summary: row.summary,
    details: row.details,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function toCamelRun(row: RunRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    issueId: row.issue_id,
    agentId: row.agent_id,
    status: row.status,
    summary: row.summary,
    stdoutExcerpt: row.stdout_excerpt,
    stderrExcerpt: row.stderr_excerpt,
    error: row.error,
    totalInputTokens: row.total_input_tokens === null ? null : Number(row.total_input_tokens),
    totalOutputTokens: row.total_output_tokens === null ? null : Number(row.total_output_tokens),
    totalCachedInputTokens:
      row.total_cached_input_tokens === null ? null : Number(row.total_cached_input_tokens),
    totalCostUsd: row.total_cost_usd === null ? null : Number(row.total_cost_usd),
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function toCamelActivity(row: ActivityRow) {
  return {
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id,
    issueId: row.issue_id,
    action: row.action,
    details: row.details,
    createdAt: row.created_at,
  };
}

function costBucket(row: CostAggregateRow | undefined) {
  return {
    tokensIn: toNumber(row?.input_tokens),
    tokensOut: toNumber(row?.output_tokens),
    cached: toNumber(row?.cached_input_tokens),
    usd: roundUsd(toNumber(row?.cost_cents)),
  };
}

function aggregateCostRows(rows: CostAggregateRow[]): Record<string, ReturnType<typeof costBucket>> {
  const result: Record<string, ReturnType<typeof costBucket>> = {};
  for (const row of rows) {
    if (!row.scope_id) continue;
    result[row.scope_id] = costBucket(row);
  }
  return result;
}

function totalCostBucket(rows: CostAggregateRow[]) {
  return rows.reduce(
    (total, row) => ({
      tokensIn: total.tokensIn + toNumber(row.input_tokens),
      tokensOut: total.tokensOut + toNumber(row.output_tokens),
      cached: total.cached + toNumber(row.cached_input_tokens),
      usd: Math.round((total.usd + roundUsd(toNumber(row.cost_cents))) * 100) / 100,
    }),
    { tokensIn: 0, tokensOut: 0, cached: 0, usd: 0 },
  );
}

function usageForPolicy(row: BudgetPolicyRow, costs: {
  total: ReturnType<typeof totalCostBucket>;
  byAgent: Record<string, ReturnType<typeof costBucket>>;
}): number {
  const cost =
    row.scope_type === "agent" ? costs.byAgent[row.scope_id] ?? costBucket(undefined) : costs.total;

  switch (row.metric) {
    case "input_tokens":
      return cost.tokensIn;
    case "output_tokens":
      return cost.tokensOut;
    case "cached_input_tokens":
      return cost.cached;
    case "usd":
      return cost.usd;
    case "billed_cents":
    default:
      return Math.round(cost.usd * 100);
  }
}

function toBudgetPolicy(row: BudgetPolicyRow, costs: {
  total: ReturnType<typeof totalCostBucket>;
  byAgent: Record<string, ReturnType<typeof costBucket>>;
}) {
  const amount = toNumber(row.amount);
  const amountUsed = usageForPolicy(row, costs);

  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    metric: row.metric,
    windowKind: row.window_kind,
    amount,
    warnPercent: toNumber(row.warn_percent),
    hardStopEnabled: row.hard_stop_enabled,
    notifyEnabled: row.notify_enabled,
    isActive: row.is_active,
    amountUsed,
    utilization: utilization(amountUsed, amount),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toBudgetIncident(row: BudgetIncidentRow) {
  return {
    id: row.id,
    policyId: row.policy_id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    metric: row.metric,
    thresholdType: row.threshold_type,
    amountLimit: toNumber(row.amount_limit),
    amountObserved: toNumber(row.amount_observed),
    status: row.status,
    approvalId: row.approval_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function buildHeartbeatSummary(runs: HeartbeatRunRow[], events: HeartbeatEventRow[]) {
  const byAgent: Record<string, { lastTickAt: string | null; lastStatus: string | null; runIds: string[] }> = {};

  for (const run of runs) {
    const current = byAgent[run.agent_id] ?? { lastTickAt: null, lastStatus: null, runIds: [] };
    current.runIds.push(run.id);
    const runTime = run.started_at ?? run.created_at;
    if (!current.lastTickAt || runTime > current.lastTickAt) {
      current.lastTickAt = runTime;
      current.lastStatus = run.status;
    }
    byAgent[run.agent_id] = current;
  }

  for (const event of events) {
    const current = byAgent[event.agent_id] ?? { lastTickAt: null, lastStatus: null, runIds: [] };
    if (!current.runIds.includes(event.run_id)) current.runIds.push(event.run_id);
    if (!current.lastTickAt || event.created_at > current.lastTickAt) {
      current.lastTickAt = event.created_at;
      current.lastStatus = event.event_type;
    }
    byAgent[event.agent_id] = current;
  }

  return {
    byAgent,
    recentEvents: events.map((event) => ({
      id: toNumber(event.id),
      runId: event.run_id,
      agentId: event.agent_id,
      eventType: event.event_type,
      stream: event.stream,
      level: event.level,
      message: event.message,
      createdAt: event.created_at,
    })),
  };
}

function toRuntimeState(row: AgentRuntimeStateRow) {
  return {
    agentId: row.agent_id,
    phase: row.last_run_status,
    sessionId: row.session_id,
    lastRunId: row.last_run_id,
    lastRunStatus: row.last_run_status,
    lastError: row.last_error,
    lastHeartbeatAt: row.updated_at,
    totalInputTokens: toNumber(row.total_input_tokens),
    totalOutputTokens: toNumber(row.total_output_tokens),
    totalCachedInputTokens: toNumber(row.total_cached_input_tokens),
    totalCostUsd: roundUsd(toNumber(row.total_cost_cents)),
  };
}

function toDocument(row: DocumentRow) {
  return {
    id: row.id,
    issueId: row.issue_id,
    key: row.key,
    title: row.title,
    format: row.format,
    latestRevisionNumber: toNumber(row.latest_revision_number),
    createdByAgentId: row.created_by_agent_id,
    updatedByAgentId: row.updated_by_agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toWorkProduct(row: WorkProductRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    issueId: row.issue_id,
    executionWorkspaceId: row.execution_workspace_id,
    runtimeServiceId: row.runtime_service_id,
    type: row.type,
    provider: row.provider,
    externalId: row.external_id,
    title: row.title,
    url: row.url,
    status: row.status,
    reviewState: row.review_state,
    isPrimary: row.is_primary,
    healthStatus: row.health_status,
    summary: row.summary,
    createdByRunId: row.created_by_run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    issueId: row.issue_id,
    assetId: row.asset_id,
    filename: row.filename,
    contentType: row.content_type,
    byteSize: row.byte_size === null ? null : toNumber(row.byte_size),
    createdAt: row.created_at,
  };
}

function toExecutionWorkspace(row: ExecutionWorkspaceRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceIssueId: row.source_issue_id,
    mode: row.mode,
    strategyType: row.strategy_type,
    name: row.name,
    status: row.status,
    cwd: row.cwd,
    repoUrl: row.repo_url,
    branchName: row.branch_name,
    providerType: row.provider_type,
    providerRef: row.provider_ref,
    lastUsedAt: row.last_used_at,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
  };
}

function toRuntimeService(row: RuntimeServiceRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    executionWorkspaceId: row.execution_workspace_id,
    issueId: row.issue_id,
    serviceName: row.service_name,
    status: row.status,
    lifecycle: row.lifecycle,
    port: row.port === null ? null : toNumber(row.port),
    url: row.url,
    provider: row.provider,
    ownerAgentId: row.owner_agent_id,
    startedByRunId: row.started_by_run_id,
    healthStatus: row.health_status,
    lastUsedAt: row.last_used_at,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
  };
}

function toPlugin(row: PluginRow) {
  return {
    id: row.id,
    pluginKey: row.plugin_key,
    packageName: row.package_name,
    version: row.version,
    status: row.status,
    categories: toStringArray(row.categories),
    lastError: row.last_error,
    updatedAt: row.updated_at,
  };
}

function toRoutineNext(row: RoutineNextRow) {
  return {
    id: row.id,
    title: row.title,
    assigneeAgentId: row.assignee_agent_id,
    status: row.status,
    triggerKind: row.trigger_kind,
    triggerLabel: row.trigger_label,
    nextRunAt: row.next_run_at,
    lastTriggeredAt: row.last_triggered_at,
  };
}

function toRoutineRun(row: RoutineRunRow) {
  return {
    id: row.id,
    routineId: row.routine_id,
    triggerId: row.trigger_id,
    source: row.source,
    status: row.status,
    linkedIssueId: row.linked_issue_id,
    triggeredAt: row.triggered_at,
    completedAt: row.completed_at,
    failureReason: row.failure_reason,
  };
}

function toIssueRelation(row: IssueRelationRow) {
  return {
    id: row.id,
    issueId: row.issue_id,
    relatedIssueId: row.related_issue_id,
    type: row.type,
    createdByAgentId: row.created_by_agent_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toIssueThreadInteraction(row: IssueThreadInteractionRow) {
  return {
    id: row.id,
    issueId: row.issue_id,
    kind: row.kind,
    status: row.status,
    continuationPolicy: row.continuation_policy,
    sourceCommentId: row.source_comment_id,
    sourceRunId: row.source_run_id,
    title: row.title,
    summary: row.summary,
    createdByAgentId: row.created_by_agent_id,
    createdByUserId: row.created_by_user_id,
    resolvedByAgentId: row.resolved_by_agent_id,
    resolvedByUserId: row.resolved_by_user_id,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toIssueExecutionDecision(row: IssueExecutionDecisionRow) {
  return {
    id: row.id,
    issueId: row.issue_id,
    stageId: row.stage_id,
    stageType: row.stage_type,
    actorAgentId: row.actor_agent_id,
    actorUserId: row.actor_user_id,
    outcome: row.outcome,
    body: row.body,
    createdByRunId: row.created_by_run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEnvironment(row: EnvironmentRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    driver: row.driver,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEnvironmentLease(row: EnvironmentLeaseRow) {
  return {
    id: row.id,
    environmentId: row.environment_id,
    executionWorkspaceId: row.execution_workspace_id,
    issueId: row.issue_id,
    heartbeatRunId: row.heartbeat_run_id,
    status: row.status,
    leasePolicy: row.lease_policy,
    provider: row.provider,
    acquiredAt: row.acquired_at,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    releasedAt: row.released_at,
    failureReason: row.failure_reason,
    cleanupStatus: row.cleanup_status,
  };
}

function toPluginManagedResource(row: PluginManagedResourceRow) {
  return {
    id: row.id,
    pluginId: row.plugin_id,
    pluginKey: row.plugin_key,
    resourceKind: row.resource_kind,
    resourceKey: row.resource_key,
    resourceId: row.resource_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCompanySecretBinding(row: CompanySecretBindingRow) {
  return {
    id: row.id,
    secretId: row.secret_id,
    targetType: row.target_type,
    targetId: row.target_id,
    configPath: row.config_path,
    versionSelector: row.version_selector,
    required: row.required,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSecretAccessEvent(row: SecretAccessEventRow) {
  return {
    id: row.id,
    secretId: row.secret_id,
    version: row.version === null ? null : toNumber(row.version),
    provider: row.provider,
    actorType: row.actor_type,
    actorId: row.actor_id,
    consumerType: row.consumer_type,
    consumerId: row.consumer_id,
    configPath: row.config_path,
    issueId: row.issue_id,
    heartbeatRunId: row.heartbeat_run_id,
    pluginId: row.plugin_id,
    outcome: row.outcome,
    errorCode: row.error_code,
    createdAt: row.created_at,
  };
}

export async function getAgencySnapshot(sql: Sql, companyId: string) {
  const normalized = asString(companyId);
  if (!normalized) {
    throw new HttpError(400, "companyId is required");
  }

  const company = await loadCompany(sql, normalized);
  const month = monthWindow();

  const [
    agents,
    projects,
    goals,
    issues,
    approvals,
    runs,
    activity,
    costByAgentRows,
    costByProjectRows,
    budgetPolicyRows,
    budgetIncidentRows,
    heartbeatRuns,
    heartbeatEvents,
    runtimeRows,
    documentRows,
    workProductRows,
    attachmentRows,
    executionWorkspaceRows,
    runtimeServiceRows,
    pluginRows,
    pluginJobCountRows,
    routineNextRows,
    routineRunRows,
    secretAggregateRows,
    issueRelationRows,
    issueThreadInteractionRows,
    issueExecutionDecisionRows,
    environmentRows,
    environmentLeaseRows,
    pluginManagedResourceRows,
    secretBindingRows,
    secretAccessEventRows,
  ] = await Promise.all([
    sql<AgentRow[]>`
      SELECT id, company_id, name, role, title, adapter_type, status, capabilities, reports_to, seat_index, created_at, updated_at
      FROM public.agents
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC, created_at DESC
    `,
    sql<ProjectRow[]>`
      SELECT id, company_id, name, summary, status, priority, created_at, updated_at
      FROM public.projects
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC, created_at DESC
    `,
    sql<GoalRow[]>`
      SELECT id, company_id, title, summary, status, owner_agent_id, created_at, updated_at
      FROM public.goals
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC, created_at DESC
    `,
    sql<IssueRow[]>`
      SELECT id, company_id, project_id, assignee_agent_id, identifier, title, description, status, priority, created_at, updated_at
      FROM public.issues
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC, created_at DESC
    `,
    sql<ApprovalRow[]>`
      SELECT id, company_id, issue_id, requested_by_agent_id, status, summary, details, resolution_note, created_at, resolved_at
      FROM public.approvals
      WHERE company_id = ${normalized}::uuid
      ORDER BY created_at DESC
    `,
    sql<RunRow[]>`
      SELECT id, company_id, issue_id, agent_id, status, summary, stdout_excerpt, stderr_excerpt, error, total_input_tokens, total_output_tokens, total_cached_input_tokens, total_cost_usd, created_at, finished_at
      FROM public.runs
      WHERE company_id = ${normalized}::uuid
      ORDER BY created_at DESC
    `,
    sql<ActivityRow[]>`
      SELECT id, company_id, agent_id, issue_id, action, details, created_at
      FROM public.activity_events
      WHERE company_id = ${normalized}::uuid
      ORDER BY created_at DESC
      LIMIT 200
    `,
    optionalRows(() => sql<CostAggregateRow[]>`
      SELECT
        agent_id AS scope_id,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(cost_cents), 0)::bigint AS cost_cents
      FROM public.cost_events
      WHERE company_id = ${normalized}::uuid
        AND occurred_at >= ${month.start}::timestamptz
        AND occurred_at < ${month.end}::timestamptz
      GROUP BY agent_id
    `),
    optionalRows(() => sql<CostAggregateRow[]>`
      SELECT
        project_id AS scope_id,
        COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(cached_input_tokens), 0)::bigint AS cached_input_tokens,
        COALESCE(SUM(cost_cents), 0)::bigint AS cost_cents
      FROM public.cost_events
      WHERE company_id = ${normalized}::uuid
        AND project_id IS NOT NULL
        AND occurred_at >= ${month.start}::timestamptz
        AND occurred_at < ${month.end}::timestamptz
      GROUP BY project_id
    `),
    optionalRows(() => sql<BudgetPolicyRow[]>`
      SELECT
        id,
        company_id,
        scope_type,
        scope_id,
        metric,
        window_kind,
        amount,
        warn_percent,
        hard_stop_enabled,
        notify_enabled,
        is_active,
        created_at,
        updated_at
      FROM public.budget_policies
      WHERE company_id = ${normalized}::uuid
        AND is_active = true
      ORDER BY updated_at DESC
    `),
    optionalRows(() => sql<BudgetIncidentRow[]>`
      SELECT
        id,
        company_id,
        policy_id,
        scope_type,
        scope_id,
        metric,
        threshold_type,
        amount_limit,
        amount_observed,
        status,
        approval_id,
        created_at,
        resolved_at
      FROM public.budget_incidents
      WHERE company_id = ${normalized}::uuid
        AND status <> 'dismissed'
      ORDER BY created_at DESC
      LIMIT 40
    `),
    optionalRows(() => sql<HeartbeatRunRow[]>`
      SELECT
        id,
        company_id,
        agent_id,
        status,
        started_at,
        finished_at,
        error,
        session_id_after,
        stdout_excerpt,
        stderr_excerpt,
        created_at
      FROM public.heartbeat_runs
      WHERE company_id = ${normalized}::uuid
      ORDER BY COALESCE(started_at, created_at) DESC
      LIMIT 80
    `),
    optionalRows(() => sql<HeartbeatEventRow[]>`
      SELECT
        id,
        company_id,
        run_id,
        agent_id,
        seq,
        event_type,
        stream,
        level,
        message,
        created_at
      FROM public.heartbeat_run_events
      WHERE company_id = ${normalized}::uuid
      ORDER BY created_at DESC, id DESC
      LIMIT 120
    `),
    optionalRows(() => sql<AgentRuntimeStateRow[]>`
      SELECT
        agent_id,
        company_id,
        session_id,
        last_run_id,
        last_run_status,
        total_input_tokens,
        total_output_tokens,
        total_cached_input_tokens,
        total_cost_cents,
        last_error,
        updated_at
      FROM public.agent_runtime_state
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
    `),
    optionalRows(() => sql<DocumentRow[]>`
      SELECT
        d.id,
        issue_documents.issue_id,
        issue_documents.key,
        d.title,
        d.format,
        d.latest_revision_number,
        d.created_by_agent_id,
        d.updated_by_agent_id,
        d.created_at,
        d.updated_at
      FROM public.documents d
      LEFT JOIN public.issue_documents
        ON issue_documents.document_id = d.id
       AND issue_documents.company_id = d.company_id
      WHERE d.company_id = ${normalized}::uuid
      ORDER BY d.updated_at DESC
      LIMIT 60
    `),
    optionalRows(() => sql<WorkProductRow[]>`
      SELECT
        id,
        project_id,
        issue_id,
        execution_workspace_id,
        runtime_service_id,
        type,
        provider,
        external_id,
        title,
        url,
        status,
        review_state,
        is_primary,
        health_status,
        summary,
        created_by_run_id,
        created_at,
        updated_at
      FROM public.issue_work_products
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
      LIMIT 80
    `),
    optionalRows(() => sql<AttachmentRow[]>`
      SELECT
        issue_attachments.id,
        issue_attachments.issue_id,
        issue_attachments.asset_id,
        assets.original_filename AS filename,
        assets.content_type,
        assets.byte_size,
        issue_attachments.created_at
      FROM public.issue_attachments
      INNER JOIN public.assets
        ON assets.id = issue_attachments.asset_id
       AND assets.company_id = issue_attachments.company_id
      WHERE issue_attachments.company_id = ${normalized}::uuid
      ORDER BY issue_attachments.created_at DESC
      LIMIT 60
    `),
    optionalRows(() => sql<ExecutionWorkspaceRow[]>`
      SELECT
        id,
        project_id,
        source_issue_id,
        mode,
        strategy_type,
        name,
        status,
        cwd,
        repo_url,
        branch_name,
        provider_type,
        provider_ref,
        last_used_at,
        opened_at,
        closed_at
      FROM public.execution_workspaces
      WHERE company_id = ${normalized}::uuid
      ORDER BY last_used_at DESC
      LIMIT 40
    `),
    optionalRows(() => sql<RuntimeServiceRow[]>`
      SELECT
        id,
        project_id,
        execution_workspace_id,
        issue_id,
        service_name,
        status,
        lifecycle,
        port,
        url,
        provider,
        owner_agent_id,
        started_by_run_id,
        health_status,
        last_used_at,
        started_at,
        stopped_at
      FROM public.workspace_runtime_services
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
      LIMIT 60
    `),
    optionalRows(() => sql<PluginRow[]>`
      SELECT
        id,
        plugin_key,
        package_name,
        version,
        categories,
        status,
        last_error,
        updated_at
      FROM public.plugins
      ORDER BY install_order NULLS LAST, updated_at DESC
      LIMIT 40
    `),
    optionalRows(() => sql<PluginJobCountRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_jobs,
        COUNT(*) FILTER (WHERE status = 'error')::int AS failing_jobs
      FROM public.plugin_jobs
    `),
    optionalRows(() => sql<RoutineNextRow[]>`
      SELECT
        routines.id,
        routines.title,
        routines.assignee_agent_id,
        routines.status,
        routine_triggers.kind AS trigger_kind,
        routine_triggers.label AS trigger_label,
        routine_triggers.next_run_at,
        routines.last_triggered_at
      FROM public.routines
      LEFT JOIN public.routine_triggers
        ON routine_triggers.routine_id = routines.id
       AND routine_triggers.company_id = routines.company_id
       AND routine_triggers.enabled = true
      WHERE routines.company_id = ${normalized}::uuid
      ORDER BY routine_triggers.next_run_at ASC NULLS LAST, routines.updated_at DESC
      LIMIT 40
    `),
    optionalRows(() => sql<RoutineRunRow[]>`
      SELECT
        id,
        routine_id,
        trigger_id,
        source,
        status,
        linked_issue_id,
        triggered_at,
        completed_at,
        failure_reason
      FROM public.routine_runs
      WHERE company_id = ${normalized}::uuid
      ORDER BY triggered_at DESC
      LIMIT 60
    `),
    optionalRows(() => sql<SecretAggregateRow[]>`
      SELECT
        COUNT(*)::int AS count,
        COALESCE(array_agg(DISTINCT provider) FILTER (WHERE provider IS NOT NULL), ARRAY[]::text[]) AS providers,
        MAX(updated_at) AS last_rotated_at
      FROM public.company_secrets
      WHERE company_id = ${normalized}::uuid
    `),
    optionalRows(() => sql<IssueRelationRow[]>`
      SELECT
        id,
        company_id,
        issue_id,
        related_issue_id,
        type,
        created_by_agent_id,
        created_by_user_id,
        created_at,
        updated_at
      FROM public.issue_relations
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
      LIMIT 200
    `),
    optionalRows(() => sql<IssueThreadInteractionRow[]>`
      SELECT
        id,
        company_id,
        issue_id,
        kind,
        status,
        continuation_policy,
        source_comment_id,
        source_run_id,
        title,
        summary,
        created_by_agent_id,
        created_by_user_id,
        resolved_by_agent_id,
        resolved_by_user_id,
        resolved_at,
        created_at,
        updated_at
      FROM public.issue_thread_interactions
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
      LIMIT 120
    `),
    optionalRows(() => sql<IssueExecutionDecisionRow[]>`
      SELECT
        id,
        company_id,
        issue_id,
        stage_id,
        stage_type,
        actor_agent_id,
        actor_user_id,
        outcome,
        body,
        created_by_run_id,
        created_at,
        updated_at
      FROM public.issue_execution_decisions
      WHERE company_id = ${normalized}::uuid
      ORDER BY created_at DESC
      LIMIT 120
    `),
    optionalRows(() => sql<EnvironmentRow[]>`
      SELECT
        id,
        company_id,
        name,
        description,
        driver,
        status,
        created_at,
        updated_at
      FROM public.environments
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
      LIMIT 40
    `),
    optionalRows(() => sql<EnvironmentLeaseRow[]>`
      SELECT
        id,
        company_id,
        environment_id,
        execution_workspace_id,
        issue_id,
        heartbeat_run_id,
        status,
        lease_policy,
        provider,
        acquired_at,
        last_used_at,
        expires_at,
        released_at,
        failure_reason,
        cleanup_status
      FROM public.environment_leases
      WHERE company_id = ${normalized}::uuid
      ORDER BY last_used_at DESC
      LIMIT 80
    `),
    optionalRows(() => sql<PluginManagedResourceRow[]>`
      SELECT
        id,
        company_id,
        plugin_id,
        plugin_key,
        resource_kind,
        resource_key,
        resource_id,
        created_at,
        updated_at
      FROM public.plugin_managed_resources
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
      LIMIT 100
    `),
    optionalRows(() => sql<CompanySecretBindingRow[]>`
      SELECT
        id,
        company_id,
        secret_id,
        target_type,
        target_id,
        config_path,
        version_selector,
        required,
        label,
        created_at,
        updated_at
      FROM public.company_secret_bindings
      WHERE company_id = ${normalized}::uuid
      ORDER BY updated_at DESC
      LIMIT 120
    `),
    optionalRows(() => sql<SecretAccessEventRow[]>`
      SELECT
        id,
        company_id,
        secret_id,
        version,
        provider,
        actor_type,
        actor_id,
        consumer_type,
        consumer_id,
        config_path,
        issue_id,
        heartbeat_run_id,
        plugin_id,
        outcome,
        error_code,
        created_at
      FROM public.secret_access_events
      WHERE company_id = ${normalized}::uuid
      ORDER BY created_at DESC
      LIMIT 120
    `),
  ]);

  const byAgentCosts = aggregateCostRows(costByAgentRows);
  const byProjectCosts = aggregateCostRows(costByProjectRows);
  const totalCosts = totalCostBucket(costByAgentRows);
  const costs = { byAgent: byAgentCosts, byProject: byProjectCosts, total: totalCosts };
  const budgetPolicies = budgetPolicyRows.map((row) => toBudgetPolicy(row, { total: totalCosts, byAgent: byAgentCosts }));
  const companyBudget =
    budgetPolicies.find((policy) => policy.scopeType === "company") ??
    budgetPolicies.find((policy) => policy.scopeId === normalized) ??
    null;
  const perAgentBudget = Object.fromEntries(
    budgetPolicies
      .filter((policy) => policy.scopeType === "agent")
      .map((policy) => [policy.scopeId, policy]),
  );
  const pluginJobCounts = pluginJobCountRows[0] ?? { active_jobs: 0, failing_jobs: 0 };
  const secretAggregate = secretAggregateRows[0] ?? { count: 0, providers: [], last_rotated_at: null };
  const runtimeState = Object.fromEntries(
    runtimeRows.map((row) => {
      const state = toRuntimeState(row);
      return [state.agentId, state];
    }),
  );
  const liveRuns = runs.filter((run) => run.status === "running" || run.status === "queued").length +
    heartbeatRuns.filter((run) => run.status === "running" || run.status === "queued").length;

  return {
    company: toCamelCompany(company),
    agents: agents.map(toCamelAgent),
    projects: projects.map(toCamelProject),
    goals: goals.map(toCamelGoal),
    issues: issues.map(toCamelIssue),
    approvals: approvals.map(toCamelApproval),
    runs: runs.map(toCamelRun),
    activity: activity.map(toCamelActivity),
    dashboard: {
      agentsOnline: agents.filter((agent) => ["active", "running", "idle"].includes(agent.status)).length,
      runsActive: liveRuns,
      openIssues: issues.filter((issue) => issue.status !== "done" && issue.status !== "cancelled").length,
      pendingApprovals: approvals.filter((approval) => approval.status === "pending").length,
      monthSpendUsd: totalCosts.usd,
      monthBudgetUsd: companyBudget && companyBudget.metric === "billed_cents" ? roundUsd(companyBudget.amount) : 0,
      budgetUtilization: companyBudget ? companyBudget.utilization : 0,
    },
    costs,
    budgets: {
      company: companyBudget,
      perAgent: perAgentBudget,
      incidents: budgetIncidentRows.map(toBudgetIncident),
    },
    heartbeats: buildHeartbeatSummary(heartbeatRuns, heartbeatEvents),
    runtimeState: {
      byAgent: runtimeState,
    },
    documents: documentRows.map(toDocument),
    workProducts: workProductRows.map(toWorkProduct),
    attachments: attachmentRows.map(toAttachment),
    executionWorkspaces: executionWorkspaceRows.map(toExecutionWorkspace),
    runtimeServices: runtimeServiceRows.map(toRuntimeService),
    plugins: {
      installed: pluginRows.map(toPlugin),
      activeJobs: toNumber(pluginJobCounts.active_jobs),
      failingJobs: toNumber(pluginJobCounts.failing_jobs),
    },
    routines: {
      upcoming: routineNextRows.map(toRoutineNext),
      recentRuns: routineRunRows.map(toRoutineRun),
    },
    secrets: {
      count: toNumber(secretAggregate.count),
      providers: toStringArray(secretAggregate.providers),
      lastRotatedAt: secretAggregate.last_rotated_at,
    },
    issueRelations: issueRelationRows.map(toIssueRelation),
    issueThreadInteractions: issueThreadInteractionRows.map(toIssueThreadInteraction),
    issueExecutionDecisions: issueExecutionDecisionRows.map(toIssueExecutionDecision),
    environments: environmentRows.map(toEnvironment),
    environmentLeases: environmentLeaseRows.map(toEnvironmentLease),
    pluginManagedResources: pluginManagedResourceRows.map(toPluginManagedResource),
    secretBindings: secretBindingRows.map(toCompanySecretBinding),
    secretAccessEvents: secretAccessEventRows.map(toSecretAccessEvent),
    source: "server" as const,
  };
}

export async function listActivity(
  sql: Sql,
  input: { companyId: string; limit?: number | null },
): Promise<ActivityRow[]> {
  const companyId = asString(input.companyId);
  if (!companyId) {
    throw new HttpError(400, "companyId is required");
  }

  const limit = Math.min(Math.max(Number(input.limit ?? 50), 1), 200);
  return await sql<ActivityRow[]>`
    SELECT id, company_id, agent_id, issue_id, action, details, created_at
    FROM public.activity_events
    WHERE company_id = ${companyId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getDashboardOverview(sql: Sql, companyId: string) {
  const snapshot = await getAgencySnapshot(sql, companyId);

  const openIssues = snapshot.issues.filter((issue) => issue.status !== "done" && issue.status !== "cancelled");
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === "pending");
  const liveRuns = snapshot.runs.filter((run) => run.status === "running" || run.status === "queued");

  return {
    metrics: {
      agents: {
        total: snapshot.agents.length,
        running: snapshot.agents.filter((agent) => agent.status === "running").length,
        active: snapshot.agents.filter((agent) => agent.status === "active").length,
      },
      issues: {
        open: openIssues.length,
        inProgress: snapshot.issues.filter((issue) => issue.status === "in_progress").length,
        blocked: snapshot.issues.filter((issue) => issue.status === "blocked").length,
      },
      runs: {
        live: liveRuns.length,
        succeeded: snapshot.runs.filter((run) => run.status === "succeeded").length,
        failed: snapshot.runs.filter((run) => run.status === "failed").length,
      },
      approvals: {
        pending: pendingApprovals.length,
      },
    },
    latestRuns: snapshot.runs.slice(0, 20).map((run) => ({
      id: run.id,
      status: run.status,
      created_at: run.createdAt,
      summary: run.summary,
      total_cost_usd: run.totalCostUsd,
    })),
    urgentIssues: snapshot.issues
      .slice()
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 20)
      .map((issue) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        assignee_agent_id: issue.assigneeAgentId,
        created_at: issue.createdAt,
        updated_at: issue.updatedAt,
      })),
    agentRows: snapshot.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      title: agent.title,
      status: agent.status,
      adapter_type: agent.adapterType,
    })),
    pendingApprovals: pendingApprovals.slice(0, 20).map((approval) => ({
      id: approval.id,
      company_id: approval.companyId,
      issue_id: approval.issueId,
      requested_by_agent_id: approval.requestedByAgentId,
      status: approval.status,
      summary: approval.summary,
      details: approval.details,
      resolution_note: approval.resolutionNote,
      created_at: approval.createdAt,
      resolved_at: approval.resolvedAt,
    })),
    recentActivity: snapshot.activity.slice(0, 20).map((entry) => ({
      id: entry.id,
      agent_id: entry.agentId,
      issue_id: entry.issueId,
      action: entry.action,
      details: entry.details,
      created_at: entry.createdAt,
    })),
  };
}
