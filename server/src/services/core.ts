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

export async function getAgencySnapshot(sql: Sql, companyId: string) {
  const normalized = asString(companyId);
  if (!normalized) {
    throw new HttpError(400, "companyId is required");
  }

  const company = await loadCompany(sql, normalized);

  const [agents, projects, goals, issues, approvals, runs, activity] = await Promise.all([
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
  ]);

  return {
    company: toCamelCompany(company),
    agents: agents.map(toCamelAgent),
    projects: projects.map(toCamelProject),
    goals: goals.map(toCamelGoal),
    issues: issues.map(toCamelIssue),
    approvals: approvals.map(toCamelApproval),
    runs: runs.map(toCamelRun),
    activity: activity.map(toCamelActivity),
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
