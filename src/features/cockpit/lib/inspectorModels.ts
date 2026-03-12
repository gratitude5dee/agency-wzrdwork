import type {
  AgentRecord,
  ApprovalRecord,
  CompanyRecord,
  IssueRecord,
  RunRecord,
} from "./domain";
import {
  agentHref,
  approvalHref,
  formatTokens,
  formatUsd,
  issueHref,
  projectHref,
  relativeTime,
  runHref,
} from "./format";
import type {
  AgentInspectorModel,
  InspectorItem,
  InspectorLink,
  InspectorTone,
  ProjectInspectorModel,
} from "../delegation/store/inspector";

const ADAPTER_LABELS: Record<string, string> = {
  claude_local: "Claude (local)",
  codex_local: "Codex (local)",
  opencode_local: "OpenCode (local)",
  openclaw_gateway: "OpenClaw Gateway",
  cursor_local: "Cursor (local)",
  pi_local: "PI (local)",
  process: "Process",
  http: "HTTP",
};

const MAX_SUMMARY_LENGTH = 220;

function clip(value: string | null | undefined, maxLength = MAX_SUMMARY_LENGTH): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function roleLabel(role: string): string {
  return role.replace(/_/g, " ");
}

function issueLabel(issue: IssueRecord): string {
  return issue.identifier ? `${issue.identifier} · ${issue.title}` : issue.title;
}

function issueTone(issue: IssueRecord): InspectorTone {
  if (issue.status === "blocked") return "warning";
  if (issue.priority === "critical") return "danger";
  if (issue.status === "in_progress" || issue.status === "in_review") return "info";
  if (issue.status === "done") return "success";
  return "default";
}

export function agentStatusTone(status: AgentRecord["status"]): InspectorTone {
  switch (status) {
    case "running":
      return "info";
    case "pending_approval":
      return "warning";
    case "error":
      return "danger";
    case "paused":
      return "muted";
    case "active":
    case "idle":
      return "success";
    default:
      return "default";
  }
}

function approvalTone(status: ApprovalRecord["status"]): InspectorTone {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
    case "revision_requested":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "muted";
  }
}

function runTone(status: RunRecord["status"]): InspectorTone {
  switch (status) {
    case "running":
    case "queued":
      return "info";
    case "succeeded":
      return "success";
    case "failed":
    case "timed_out":
      return "danger";
    case "cancelled":
      return "muted";
    default:
      return "default";
  }
}

function issueSortRank(issue: IssueRecord, approval: ApprovalRecord | undefined): number {
  if (approval && approval.status === "pending") return 0;
  if (issue.status === "blocked") return 1;
  if (issue.priority === "critical") return 2;
  if (issue.priority === "high") return 3;
  if (issue.status === "in_progress") return 4;
  if (issue.status === "in_review") return 5;
  if (issue.status === "todo") return 6;
  if (issue.status === "backlog") return 7;
  return 8;
}

function buildIssueItem(issue: IssueRecord, assigneeName?: string | null): InspectorItem {
  return {
    title: issueLabel(issue),
    subtitle: `${issue.status.replace(/_/g, " ")} · ${issue.priority}`,
    meta: assigneeName ? `${assigneeName} · ${relativeTime(issue.updatedAt)}` : relativeTime(issue.updatedAt),
    href: issueHref(issue.id),
    tone: issueTone(issue),
  };
}

function buildLinks(paths: Array<{ label: string; href: string | null | undefined }>): InspectorLink[] {
  return paths
    .filter((entry) => Boolean(entry.href))
    .map((entry) => ({
      label: entry.label,
      href: entry.href!,
    }));
}

export function summarizeRun(run: RunRecord): string {
  return (
    clip(run.summary) ??
    clip(run.stdoutExcerpt) ??
    clip(run.stderrExcerpt) ??
    clip(run.error) ??
    `Run ${run.status}`
  );
}

export function buildProjectInspectorModel(input: {
  company: CompanyRecord;
  agentCount: number;
  liveRunCount: number;
  approvals: ApprovalRecord[];
  issues: IssueRecord[];
  agentNameById: Map<string, string>;
}): ProjectInspectorModel {
  const openIssues = input.issues.filter(
    (issue) => issue.status !== "done" && issue.status !== "cancelled",
  );
  const pendingApprovals = input.approvals.filter(
    (approval) => approval.status === "pending" || approval.status === "revision_requested",
  );
  const heldCount = openIssues.filter((issue) => issue.status === "blocked").length + pendingApprovals.length;

  const urgentIssues = [...openIssues]
    .sort((left, right) => {
      const leftApproval = input.approvals.find(
        (approval) => approval.requestedByAgentId === left.assigneeAgentId,
      );
      const rightApproval = input.approvals.find(
        (approval) => approval.requestedByAgentId === right.assigneeAgentId,
      );
      const rank = issueSortRank(left, leftApproval);
      const otherRank = issueSortRank(right, rightApproval);
      if (rank !== otherRank) return rank - otherRank;
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    })
    .slice(0, 4)
    .map((issue) =>
      buildIssueItem(
        issue,
        issue.assigneeAgentId ? input.agentNameById.get(issue.assigneeAgentId) ?? null : null,
      ),
    );

  return {
    companyName: input.company.name,
    companyType: input.company.companyType,
    companyDescription: input.company.description,
    brief: input.company.brief,
    stats: [
      { label: "Agents", value: String(input.agentCount), tone: "info" },
      { label: "Open issues", value: String(openIssues.length), tone: openIssues.length ? "default" : "muted" },
      { label: "On hold", value: String(heldCount), tone: heldCount ? "warning" : "muted" },
      { label: "Live runs", value: String(input.liveRunCount), tone: input.liveRunCount ? "info" : "muted" },
      { label: "Approvals", value: String(pendingApprovals.length), tone: pendingApprovals.length ? "warning" : "muted" },
    ],
    urgentIssues,
    links: buildLinks([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Inbox", href: "/inbox" },
      { label: "Approvals", href: "/approvals" },
      { label: "Projects", href: "/projects" },
    ]),
  };
}

export function buildAgentInspectorModel(input: {
  agent: AgentRecord;
  manager: AgentRecord | null;
  activeIssue: IssueRecord | null;
  recentIssues: IssueRecord[];
  approval?: ApprovalRecord | null;
  latestRun: RunRecord | null;
}): AgentInspectorModel {
  const adapterLabel =
    ADAPTER_LABELS[input.agent.adapterType] ?? input.agent.adapterType.replace(/_/g, " ");

  return {
    agentName: input.agent.name,
    statusLabel: input.agent.status.replace(/_/g, " "),
    statusTone: agentStatusTone(input.agent.status),
    adapterLabel,
    manager: input.manager
      ? {
          label: input.manager.name,
          href: agentHref(input.manager.id),
        }
      : undefined,
    activeIssue: input.activeIssue
      ? buildIssueItem(input.activeIssue, input.agent.name)
      : undefined,
    recentIssues: input.recentIssues.slice(0, 4).map((issue) => buildIssueItem(issue, input.agent.name)),
    latestRun: input.latestRun
      ? {
          label: "Latest run",
          statusLabel: input.latestRun.status.replace(/_/g, " "),
          statusTone: runTone(input.latestRun.status),
          summary: summarizeRun(input.latestRun),
          meta: relativeTime(input.latestRun.createdAt),
          href: runHref(input.latestRun.id),
          isLive:
            input.latestRun.status === "running" || input.latestRun.status === "queued",
          error: clip(input.latestRun.error, 140),
        }
      : undefined,
    pendingApproval: input.approval
      ? {
          label: "Approval",
          statusLabel: input.approval.status.replace(/_/g, " "),
          tone: approvalTone(input.approval.status),
          meta: clip(input.approval.summary, 120) ?? relativeTime(input.approval.createdAt),
          href: approvalHref(input.approval.id),
        }
      : undefined,
    lastHeartbeat: input.latestRun ? relativeTime(input.latestRun.createdAt) : undefined,
    session: input.latestRun?.id ?? undefined,
    lastError: clip(input.latestRun?.error, 140),
    tokenStats: input.latestRun
      ? [
          { label: "Input", value: formatTokens(input.latestRun.totalInputTokens), tone: "muted" },
          { label: "Output", value: formatTokens(input.latestRun.totalOutputTokens), tone: "muted" },
          { label: "Cached", value: formatTokens(input.latestRun.totalCachedInputTokens), tone: "muted" },
        ]
      : [],
    totalCost: input.latestRun ? formatUsd(input.latestRun.totalCostUsd) : undefined,
    links: buildLinks([
      { label: "Agent", href: agentHref(input.agent.id) },
      { label: "Issue", href: input.activeIssue ? issueHref(input.activeIssue.id) : null },
      { label: "Approval", href: input.approval ? approvalHref(input.approval.id) : null },
      { label: "Project", href: input.activeIssue?.projectId ? projectHref(input.activeIssue.projectId) : null },
    ]),
  };
}
