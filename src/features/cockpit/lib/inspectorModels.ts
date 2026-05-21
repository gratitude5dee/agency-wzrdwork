import type {
  AgentRecord,
  ApprovalRecord,
  CompanyRecord,
  IssueRecord,
  RunRecord,
  SnapshotBudgetPolicy,
  SnapshotCompanySecretBinding,
  SnapshotDocument,
  SnapshotEnvironment,
  SnapshotEnvironmentLease,
  SnapshotExecutionWorkspace,
  SnapshotHeartbeatAgent,
  SnapshotHeartbeatEvent,
  SnapshotIssueExecutionDecision,
  SnapshotIssueRelation,
  SnapshotIssueThreadInteraction,
  SnapshotPluginManagedResource,
  SnapshotRoutineNext,
  SnapshotRuntimeService,
  SnapshotRuntimeState,
  SnapshotSecretAccessEvent,
  SnapshotSecrets,
  SnapshotWorkProduct,
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
import type { AgentVisualState } from "../delegation/store/agencyStore";

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

function visualStateTone(state: AgentVisualState): InspectorTone {
  switch (state) {
    case "over_budget":
    case "failed":
      return "danger";
    case "awaiting_approval":
    case "blocked":
    case "needs_input":
      return "warning";
    case "working":
    case "heartbeat_tick":
    case "queued":
    case "producing_work_product":
      return "info";
    case "completed":
      return "success";
    case "paused":
    case "terminated":
      return "muted";
    default:
      return "default";
  }
}

function stateLabel(value: string): string {
  return value.replace(/_/g, " ");
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
  monthSpendUsd: number;
  monthBudgetUsd: number;
  budgetUtilization: number;
  failingPlugins: number;
  routineFailures: number;
  secretCount: number;
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
      {
        label: "Spend",
        value: input.monthBudgetUsd > 0
          ? `${formatUsd(input.monthSpendUsd)} / ${formatUsd(input.monthBudgetUsd)}`
          : formatUsd(input.monthSpendUsd),
        tone: input.budgetUtilization >= 100 ? "danger" : input.budgetUtilization >= 80 ? "warning" : "muted",
      },
      { label: "Plugins", value: String(input.failingPlugins), tone: input.failingPlugins ? "danger" : "muted" },
      { label: "Routines", value: String(input.routineFailures), tone: input.routineFailures ? "warning" : "muted" },
      { label: "Secrets", value: String(input.secretCount), tone: input.secretCount ? "info" : "muted" },
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
  visualState: AgentVisualState;
  runtimeState?: SnapshotRuntimeState | null;
  heartbeat?: SnapshotHeartbeatAgent | null;
  heartbeatEvents: SnapshotHeartbeatEvent[];
  budget?: SnapshotBudgetPolicy | null;
  documents: SnapshotDocument[];
  workProducts: SnapshotWorkProduct[];
  workspaces: SnapshotExecutionWorkspace[];
  environments: SnapshotEnvironment[];
  environmentLeases: SnapshotEnvironmentLease[];
  runtimeServices: SnapshotRuntimeService[];
  routines: SnapshotRoutineNext[];
  issueRelations: SnapshotIssueRelation[];
  threadInteractions: SnapshotIssueThreadInteraction[];
  executionDecisions: SnapshotIssueExecutionDecision[];
  pluginResources: SnapshotPluginManagedResource[];
  secretBindings: SnapshotCompanySecretBinding[];
  secretAccessEvents: SnapshotSecretAccessEvent[];
  secrets: SnapshotSecrets;
}): AgentInspectorModel {
  const adapterLabel =
    ADAPTER_LABELS[input.agent.adapterType] ?? input.agent.adapterType.replace(/_/g, " ");
  const latestHeartbeatAt = input.heartbeat?.lastTickAt ?? input.runtimeState?.lastHeartbeatAt ?? input.latestRun?.createdAt;
  const tokenStats = input.runtimeState
    ? [
        { label: "Input", value: formatTokens(input.runtimeState.totalInputTokens), tone: "muted" as const },
        { label: "Output", value: formatTokens(input.runtimeState.totalOutputTokens), tone: "muted" as const },
        { label: "Cached", value: formatTokens(input.runtimeState.totalCachedInputTokens), tone: "muted" as const },
      ]
    : input.latestRun
      ? [
          { label: "Input", value: formatTokens(input.latestRun.totalInputTokens), tone: "muted" as const },
          { label: "Output", value: formatTokens(input.latestRun.totalOutputTokens), tone: "muted" as const },
          { label: "Cached", value: formatTokens(input.latestRun.totalCachedInputTokens), tone: "muted" as const },
        ]
      : [];

  return {
    agentName: input.agent.name,
    statusLabel: input.agent.status.replace(/_/g, " "),
    statusTone: agentStatusTone(input.agent.status),
    visualState: input.visualState,
    visualStateLabel: stateLabel(input.visualState),
    visualStateTone: visualStateTone(input.visualState),
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
    workProducts: input.workProducts.slice(0, 4).map((product) => ({
      title: product.title,
      subtitle: `${product.type} · ${product.status}`,
      meta: clip(product.summary, 120) ?? relativeTime(product.updatedAt),
      href: product.url ?? undefined,
      tone: product.healthStatus === "error" || product.status === "failed" ? "danger" : product.isPrimary ? "info" : "default",
    })),
    documents: input.documents.slice(0, 4).map((document) => ({
      title: document.title ?? document.key ?? "Untitled document",
      subtitle: `${document.format} · rev ${document.latestRevisionNumber}`,
      meta: relativeTime(document.updatedAt),
      href: "/documents",
      tone: "default",
    })),
    governanceItems: [
      ...input.issueRelations.slice(0, 3).map((relation) => ({
        title: relation.type === "blocks" ? "Blocking relation" : relation.type,
        subtitle: `${relation.issueId.slice(0, 8)} -> ${relation.relatedIssueId.slice(0, 8)}`,
        meta: relativeTime(relation.updatedAt),
        href: issueHref(relation.relatedIssueId),
        tone: "warning" as const,
      })),
      ...input.threadInteractions.slice(0, 3).map((interaction) => ({
        title: interaction.title ?? interaction.kind.replace(/[._]/g, " "),
        subtitle: `${interaction.status} · ${interaction.continuationPolicy.replace(/_/g, " ")}`,
        meta: clip(interaction.summary, 120) ?? relativeTime(interaction.updatedAt),
        href: issueHref(interaction.issueId),
        tone: interaction.status === "failed" ? "danger" as const : interaction.status === "pending" ? "warning" as const : "info" as const,
      })),
      ...input.executionDecisions.slice(0, 3).map((decision) => ({
        title: decision.outcome.replace(/[._]/g, " "),
        subtitle: decision.stageType.replace(/[._]/g, " "),
        meta: clip(decision.body, 120) ?? relativeTime(decision.createdAt),
        href: issueHref(decision.issueId),
        tone: decision.outcome.includes("reject") || decision.outcome.includes("fail") ? "danger" as const : "default" as const,
      })),
    ].slice(0, 6),
    workspaceItems: input.workspaces.slice(0, 3).map((workspace) => ({
      title: workspace.name,
      subtitle: `${workspace.providerType} · ${workspace.status}`,
      meta: workspace.branchName ?? workspace.cwd ?? relativeTime(workspace.lastUsedAt),
      href: "/workspaces",
      tone: workspace.status === "active" ? "info" : "muted",
    })),
    environmentItems: [
      ...input.environmentLeases.slice(0, 3).map((lease) => {
        const environment = input.environments.find((item) => item.id === lease.environmentId);
        return {
          title: environment?.name ?? lease.provider ?? "Environment lease",
          subtitle: `${environment?.driver ?? lease.provider ?? "environment"} · ${lease.status}`,
          meta: lease.failureReason ?? lease.cleanupStatus ?? relativeTime(lease.lastUsedAt),
          href: "/workspaces",
          tone: lease.status === "active" ? "info" as const : lease.failureReason ? "danger" as const : "muted" as const,
        };
      }),
      ...input.environments.slice(0, 2).map((environment) => ({
        title: environment.name,
        subtitle: `${environment.driver} · ${environment.status}`,
        meta: environment.description ?? relativeTime(environment.updatedAt),
        href: "/workspaces",
        tone: environment.status === "active" ? "info" as const : "muted" as const,
      })),
    ].slice(0, 4),
    runtimeServices: input.runtimeServices.slice(0, 3).map((service) => ({
      title: service.serviceName,
      subtitle: `${service.provider} · ${service.status}`,
      meta: service.url ?? (service.port ? `:${service.port}` : relativeTime(service.lastUsedAt)),
      href: service.url ?? "/workspaces",
      tone: service.healthStatus === "healthy" ? "success" : service.status === "running" ? "info" : "default",
    })),
    routineItems: input.routines.slice(0, 3).map((routine) => ({
      title: routine.title,
      subtitle: `${routine.status} · ${routine.triggerKind ?? "routine"}`,
      meta: routine.nextRunAt ? `Next ${relativeTime(routine.nextRunAt)}` : "No next run",
      href: "/activity",
      tone: routine.status === "active" ? "info" : "muted",
    })),
    pluginResourceItems: input.pluginResources.slice(0, 4).map((resource) => ({
      title: resource.resourceKey,
      subtitle: `${resource.pluginKey} · ${resource.resourceKind}`,
      meta: relativeTime(resource.updatedAt),
      href: "/plugins",
      tone: "info",
    })),
    secretItems: [
      ...input.secretBindings.slice(0, 3).map((binding) => ({
        title: binding.label ?? binding.configPath,
        subtitle: `${binding.targetType} · ${binding.versionSelector}`,
        meta: binding.required ? "Required secret binding" : "Optional secret binding",
        href: "/settings",
        tone: binding.required ? "info" as const : "muted" as const,
      })),
      ...input.secretAccessEvents.slice(0, 3).map((event) => ({
        title: event.outcome.replace(/[._]/g, " "),
        subtitle: `${event.provider} · ${event.consumerType}`,
        meta: event.errorCode ?? relativeTime(event.createdAt),
        href: "/settings",
        tone: event.outcome === "success" ? "success" as const : "warning" as const,
      })),
      ...(input.secrets.count > 0
        ? [
          {
            title: `${input.secrets.count} secret${input.secrets.count === 1 ? "" : "s"}`,
            subtitle: input.secrets.providers.join(", ") || "metadata only",
            meta: input.secrets.lastRotatedAt ? `Rotated ${relativeTime(input.secrets.lastRotatedAt)}` : "No rotation timestamp",
            href: "/settings",
            tone: "muted" as const,
          },
        ]
        : []),
    ].slice(0, 6),
    heartbeatItems: input.heartbeatEvents.slice(0, 4).map((event) => ({
      title: event.eventType.replace(/[._]/g, " "),
      subtitle: [event.stream, event.level].filter(Boolean).join(" · ") || "heartbeat event",
      meta: clip(event.message, 120) ?? relativeTime(event.createdAt),
      href: runHref(event.runId),
      tone: event.level === "error" ? "danger" : event.level === "warn" ? "warning" : "default",
    })),
    budget: input.budget
      ? {
          label: "Budget",
          value: `${input.budget.utilization}%`,
          tone: input.budget.utilization >= 100 ? "danger" : input.budget.utilization >= input.budget.warnPercent ? "warning" : "muted",
        }
      : undefined,
    lastHeartbeat: latestHeartbeatAt ? relativeTime(latestHeartbeatAt) : undefined,
    session: input.runtimeState?.sessionId ?? input.latestRun?.id ?? undefined,
    lastError: clip(input.runtimeState?.lastError ?? input.latestRun?.error, 140),
    tokenStats,
    totalCost: input.runtimeState ? formatUsd(input.runtimeState.totalCostUsd) : input.latestRun ? formatUsd(input.latestRun.totalCostUsd) : undefined,
    links: buildLinks([
      { label: "Agent", href: agentHref(input.agent.id) },
      { label: "Issue", href: input.activeIssue ? issueHref(input.activeIssue.id) : null },
      { label: "Approval", href: input.approval ? approvalHref(input.approval.id) : null },
      { label: "Project", href: input.activeIssue?.projectId ? projectHref(input.activeIssue.projectId) : null },
    ]),
  };
}
