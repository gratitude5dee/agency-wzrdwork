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

export interface AgencySnapshot {
  company: CompanyRecord;
  agents: AgentRecord[];
  projects: ProjectRecord[];
  goals: GoalRecord[];
  issues: IssueRecord[];
  approvals: ApprovalRecord[];
  runs: RunRecord[];
  activity: ActivityRecord[];
  source: "supabase" | "demo";
  sourceMessage?: string;
}

export interface CreateIssueInput {
  title: string;
  description: string;
  assigneeAgentId: string | null;
  projectId: string | null;
  priority: IssuePriority;
}
