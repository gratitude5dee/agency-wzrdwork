import {
  PLAYER_INDEX,
  RUNTIME_AGENT_SET_ID,
  type AgentData,
  type AgentSet,
} from "../delegation/data/agents";
import {
  type ActionLogEntry,
  type DebugLogEntry,
  type ProjectPhase,
  type Task,
} from "../delegation/store/agencyStore";
import { buildAgentInspectorModel, buildProjectInspectorModel, summarizeRun } from "./inspectorModels";
import type {
  ActivityRecord,
  AgencySnapshot,
  AgentRecord,
  ApprovalRecord,
  IssueRecord,
  RunRecord,
} from "./domain";
import { toTimestamp } from "./format";

const AGENT_COLORS = [
  "#4387E2",
  "#22c55e",
  "#EF52BA",
  "#eab308",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#f59e0b",
  "#ec4899",
];

const MAX_RENDERED_AGENTS = 12;

function agentStatusRank(status: AgentRecord["status"]) {
  switch (status) {
    case "running":
      return 0;
    case "pending_approval":
      return 1;
    case "active":
    case "idle":
      return 2;
    case "paused":
      return 3;
    case "error":
      return 4;
    default:
      return 5;
  }
}

function issuePriority(issue: IssueRecord) {
  switch (issue.status) {
    case "blocked":
      return 0;
    case "in_progress":
      return 1;
    case "in_review":
      return 2;
    case "todo":
      return 3;
    case "backlog":
      return 4;
    default:
      return 5;
  }
}

function splitCapabilities(capabilities: string | null): string[] {
  if (!capabilities) return [];
  return capabilities
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function pickManager(agents: AgentRecord[]): AgentRecord | null {
  return (
    agents.find((agent) => agent.role === "ceo") ??
    agents.find((agent) => agent.reportsTo === null) ??
    agents[0] ??
    null
  );
}

function getAgentColor(index: number, brandColor: string, isManager: boolean): string {
  if (isManager) return brandColor;
  return AGENT_COLORS[index % AGENT_COLORS.length]!;
}

function findActiveIssue(agentId: string, issues: IssueRecord[]): IssueRecord | null {
  const candidates = issues
    .filter(
      (issue) =>
        issue.assigneeAgentId === agentId &&
        issue.status !== "done" &&
        issue.status !== "cancelled",
    )
    .sort((a, b) => {
      const rank = issuePriority(a) - issuePriority(b);
      if (rank !== 0) return rank;
      return toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
    });

  return candidates[0] ?? null;
}

function humanizeAction(event: ActivityRecord, issuesById: Map<string, IssueRecord>): string {
  const issue = event.issueId ? issuesById.get(event.issueId) : undefined;
  const issueLabel = issue?.identifier ?? issue?.title ?? "issue";

  switch (event.action) {
    case "issue.created":
      return `opened ${issueLabel}`;
    case "issue.updated":
      return `updated ${issueLabel}`;
    case "approval.requested":
      return `requested approval for ${issueLabel}`;
    case "run.started":
      return `started ${issueLabel}`;
    case "run.completed":
      return `completed ${issueLabel}`;
    default:
      return event.details ?? event.action.replace(/[._]/g, " ");
  }
}

function mapIssueStatus(issue: IssueRecord, approval: ApprovalRecord | undefined): Task["status"] {
  if (issue.status === "done" || issue.status === "cancelled") return "done";
  if (issue.status === "blocked" || approval?.status === "pending") return "on_hold";
  if (issue.status === "in_progress" || issue.status === "in_review") return "in_progress";
  return "scheduled";
}

function derivePhase(tasks: Task[]): ProjectPhase {
  if (tasks.length === 0) return "idle";
  if (tasks.every((task) => task.status === "done")) return "done";
  if (tasks.some((task) => task.status === "on_hold")) return "awaiting_approval";
  return "working";
}

export interface CockpitRuntime {
  agentSet: AgentSet;
  tasks: Task[];
  actionLog: ActionLogEntry[];
  debugLog: DebugLogEntry[];
  phase: ProjectPhase;
  projectInspector: ReturnType<typeof buildProjectInspectorModel>;
  agentInspectors: Record<number, ReturnType<typeof buildAgentInspectorModel>>;
}

export function buildCockpitRuntime(snapshot: AgencySnapshot): CockpitRuntime {
  const manager = pickManager(snapshot.agents);
  const visibleAgents = snapshot.agents
    .filter((agent) => agent.status !== "terminated")
    .sort((a, b) => {
      if (manager && a.id === manager.id) return -1;
      if (manager && b.id === manager.id) return 1;

      const rank = agentStatusRank(a.status) - agentStatusRank(b.status);
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name);
    });

  const renderedAgents = visibleAgents.slice(0, MAX_RENDERED_AGENTS);
  const runtimeIndexByAgentId = new Map<string, number>();
  const issuesById = new Map(snapshot.issues.map((issue) => [issue.id, issue]));
  const agentNameById = new Map(snapshot.agents.map((agent) => [agent.id, agent.name]));
  const pendingApprovalsByAgentId = new Map(
    snapshot.approvals
      .filter((approval) => approval.status === "pending" && approval.requestedByAgentId)
      .map((approval) => [approval.requestedByAgentId!, approval]),
  );

  const agentEntries: AgentData[] = [
    {
      index: PLAYER_INDEX,
      department: "Board",
      role: "You",
      expertise: ["Governance", "Approvals", "Direction"],
      mission: "Review live company work, approve decisions, and guide the team.",
      personality: "Direct, decisive, and outcome-oriented.",
      isPlayer: true,
      color: "#7EACEA",
    },
  ];

  renderedAgents.forEach((agent, position) => {
    const runtimeIndex = position + 1;
    const isManager = manager?.id === agent.id;
    const activeIssue = findActiveIssue(agent.id, snapshot.issues);

    runtimeIndexByAgentId.set(agent.id, runtimeIndex);
    agentEntries.push({
      index: runtimeIndex,
      department: isManager ? "Coordination" : agent.role.replace(/_/g, " "),
      role: agent.title ?? agent.role.replace(/_/g, " "),
      expertise:
        splitCapabilities(agent.capabilities).length > 0
          ? splitCapabilities(agent.capabilities)
          : [agent.adapterType.replace(/_/g, " "), agent.status],
      mission:
        activeIssue?.title ??
        agent.capabilities ??
        `${agent.name} is available through the ${agent.adapterType.replace(/_/g, " ")} adapter.`,
      personality: `${agent.name} running as ${agent.adapterType.replace(/_/g, " ")}.`,
      isPlayer: false,
      color: getAgentColor(position, snapshot.company.brandColor, isManager),
    });
  });

  const tasks = snapshot.issues
    .filter((issue) => issue.assigneeAgentId && runtimeIndexByAgentId.has(issue.assigneeAgentId))
    .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
    .map((issue) => {
      const runtimeIndex = runtimeIndexByAgentId.get(issue.assigneeAgentId!)!;
      const approval = pendingApprovalsByAgentId.get(issue.assigneeAgentId!);

      return {
        id: issue.id,
        title: issue.identifier ? `${issue.identifier} · ${issue.title}` : issue.title,
        description: issue.description ?? issue.title,
        assignedAgentIds: [runtimeIndex],
        status: mapIssueStatus(issue, approval),
        requiresClientApproval: approval?.status === "pending",
        output: issue.status === "done" ? issue.description ?? issue.title : undefined,
        createdAt: toTimestamp(issue.createdAt),
        updatedAt: toTimestamp(issue.updatedAt),
      } satisfies Task;
    });

  const actionLog = snapshot.activity
    .map((event) => {
      if (!event.agentId) return null;
      const runtimeIndex = runtimeIndexByAgentId.get(event.agentId);
      if (!runtimeIndex) return null;

      return {
        id: event.id,
        timestamp: toTimestamp(event.createdAt),
        agentIndex: runtimeIndex,
        action: humanizeAction(event, issuesById),
        taskId: event.issueId ?? undefined,
      } satisfies ActionLogEntry;
    })
    .filter(Boolean)
    .sort((a, b) => b!.timestamp - a!.timestamp)
    .slice(0, 80) as ActionLogEntry[];

  const debugLog = snapshot.runs
    .map((run) => {
      const runtimeIndex = runtimeIndexByAgentId.get(run.agentId);
      if (!runtimeIndex) return null;
      const agentName = agentNameById.get(run.agentId) ?? "Agent";
      const activeIssue = run.issueId ? issuesById.get(run.issueId) : null;

      return {
        id: run.id,
        timestamp: toTimestamp(run.createdAt),
        agentIndex: runtimeIndex,
        agentName,
        phase: "response" as const,
        systemPrompt: "Sandbox runtime snapshot",
        dynamicContext: activeIssue?.title ?? snapshot.company.brief,
        messages: [
          { role: "system", content: snapshot.company.brief },
          { role: "assistant", content: summarizeRun(run) },
        ],
        rawContent: JSON.stringify(
          {
            text: summarizeRun(run),
            issue: activeIssue?.title ?? null,
            status: run.status,
            tokens: {
              input: run.totalInputTokens,
              output: run.totalOutputTokens,
              cached: run.totalCachedInputTokens,
            },
          },
          null,
          2,
        ),
        status: run.status === "failed" ? "error" : run.status === "running" ? "pending" : "completed",
        taskId: run.issueId ?? undefined,
      } satisfies DebugLogEntry;
    })
    .filter(Boolean)
    .sort((a, b) => b!.timestamp - a!.timestamp)
    .slice(0, 40) as DebugLogEntry[];

  const liveRunCount = snapshot.runs.filter(
    (run) => run.status === "queued" || run.status === "running",
  ).length;

  const projectInspector = buildProjectInspectorModel({
    company: snapshot.company,
    agentCount: renderedAgents.length,
    liveRunCount,
    approvals: snapshot.approvals,
    issues: snapshot.issues,
    agentNameById,
  });

  const agentInspectors: Record<number, ReturnType<typeof buildAgentInspectorModel>> = {};
  renderedAgents.forEach((agent) => {
    const runtimeIndex = runtimeIndexByAgentId.get(agent.id)!;
    const activeIssue = findActiveIssue(agent.id, snapshot.issues);
    const recentIssues = snapshot.issues
      .filter((issue) => issue.assigneeAgentId === agent.id)
      .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt));
    const latestRun =
      [...snapshot.runs]
        .filter((run) => run.agentId === agent.id)
        .sort((a, b) => toTimestamp(b.createdAt) - toTimestamp(a.createdAt))[0] ?? null;

    agentInspectors[runtimeIndex] = buildAgentInspectorModel({
      agent,
      manager: manager && manager.id !== agent.id ? manager : null,
      activeIssue,
      recentIssues,
      approval: pendingApprovalsByAgentId.get(agent.id) ?? null,
      latestRun,
    });
  });

  const phase = derivePhase(tasks);
  const agentSet: AgentSet = {
    id: RUNTIME_AGENT_SET_ID,
    companyName: snapshot.company.name,
    companyType: snapshot.company.companyType,
    companyDescription: snapshot.company.description,
    color: snapshot.company.brandColor,
    agents: agentEntries,
  };

  return {
    agentSet,
    tasks,
    actionLog,
    debugLog,
    phase,
    projectInspector,
    agentInspectors,
  };
}
