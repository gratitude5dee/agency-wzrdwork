import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveAccount } from "thirdweb/react";
import { ChevronDown, ChevronRight, Columns3, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAgencyData } from "@/features/cockpit/lib/useAgencyData";
import type { AgencySnapshot, IssuePriority, IssueStatus } from "@/features/cockpit/lib/domain";
import { getClientWalletAddress } from "@/lib/server-api/actor";
import { updateIssueStatusRecord } from "@/lib/server-api/issues";

/* ── Types ── */

interface IssueRow {
  id: string;
  identifier: string | null;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
  company_id: string;
  description: string | null;
  assignee_agent_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentLookup {
  id: string;
  name: string;
}

/* ── Constants ── */

const BOARD_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const satisfies readonly IssueStatus[];

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  low: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400",
};

const STATUS_DOT_COLORS: Record<string, string> = {
  backlog: "bg-zinc-500",
  todo: "bg-blue-400",
  in_progress: "bg-cyan-400",
  in_review: "bg-purple-400",
  blocked: "bg-red-400",
  done: "bg-green-400",
  cancelled: "bg-zinc-600",
};

/* ── Droppable Column ── */

function KanbanColumn({
  status,
  issues,
  agentMap,
}: {
  status: string;
  issues: IssueRow[];
  agentMap: Map<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col min-w-[240px] w-[240px] shrink-0">
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            STATUS_DOT_COLORS[status] ?? "bg-zinc-500",
          )}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {statusLabel(status)}
        </span>
        <span className="text-xs text-muted-foreground/60 ml-auto tabular-nums">
          {issues.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[80px] rounded-md p-1 space-y-1 transition-colors",
          isOver ? "bg-accent/40" : "bg-muted/20",
        )}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.map((issue) => (
            <KanbanCard key={issue.id} issue={issue} agentMap={agentMap} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

/* ── Draggable Card ── */

function KanbanCard({
  issue,
  agentMap,
  isOverlay,
}: {
  issue: IssueRow;
  agentMap: Map<string, string>;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, data: { issue } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityClass =
    PRIORITY_COLORS[issue.priority] ?? PRIORITY_COLORS.low;

  const assigneeName = issue.assignee_agent_id
    ? agentMap.get(issue.assignee_agent_id) ?? null
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-md border border-white/10 bg-[#0d1118] p-2.5 cursor-grab active:cursor-grabbing transition-shadow",
        isDragging && !isOverlay ? "opacity-30" : "",
        isOverlay
          ? "shadow-lg ring-1 ring-primary/20"
          : "hover:shadow-sm hover:border-white/20",
      )}
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {issue.identifier ?? issue.id.slice(0, 8)}
        </span>
      </div>
      <p className="text-sm leading-snug line-clamp-2 mb-2 text-zinc-100">
        {issue.title}
      </p>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold",
            priorityClass,
          )}
        >
          {issue.priority}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-zinc-400">
          <User className="h-3 w-3" />
          {assigneeName ?? "Unassigned"}
        </span>
      </div>
    </div>
  );
}

/* ── Main Panel ── */

export function KanbanPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const account = useActiveAccount();
  const walletAddress = getClientWalletAddress(account?.address);
  const { snapshot } = useAgencyData();
  const companyId = snapshot.company.id;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const issues = useMemo<IssueRow[]>(
    () =>
      snapshot.issues.map((issue) => ({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        status: issue.status,
        priority: issue.priority,
        company_id: issue.companyId,
        description: issue.description,
        assignee_agent_id: issue.assigneeAgentId,
        project_id: issue.projectId,
        created_at: issue.createdAt,
        updated_at: issue.updatedAt,
      })),
    [snapshot.issues],
  );

  const agents = useMemo<AgentLookup[]>(
    () =>
      snapshot.agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
      })),
    [snapshot.agents],
  );

  const agentMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a.name])),
    [agents],
  );

  /* ── Status update mutation ── */

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      issueId,
      status,
    }: {
      issueId: string;
      status: IssueStatus;
    }) => {
      await updateIssueStatusRecord({
        issueId,
        status,
        companyId,
        walletAddress,
      });
    },
    onMutate: async ({ issueId, status }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["agency-snapshot", companyId] });
      const previous = queryClient.getQueryData<AgencySnapshot>(["agency-snapshot", companyId]);

      queryClient.setQueryData<AgencySnapshot>(["agency-snapshot", companyId], (old) =>
        old
          ? {
              ...old,
              issues: old.issues.map((issue) =>
                issue.id === issueId ? { ...issue, status } : issue,
              ),
            }
          : old,
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["agency-snapshot", companyId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-snapshot", companyId] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview", companyId] });
    },
  });

  /* ── Grouped issues ── */

  const columnIssues = useMemo(() => {
    const grouped: Record<string, IssueRow[]> = {};
    for (const status of BOARD_STATUSES) {
      grouped[status] = [];
    }
    for (const issue of issues) {
      if (grouped[issue.status]) {
        grouped[issue.status].push(issue);
      }
    }
    return grouped;
  }, [issues]);

  const activeIssue = useMemo(
    () => (activeId ? issues.find((i) => i.id === activeId) ?? null : null),
    [activeId, issues],
  );

  /* ── Drag handlers ── */

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    // Determine target status: "over" could be a column id (status string) or a card id
    let targetStatus: IssueStatus | null = null;

    if (BOARD_STATUSES.includes(over.id as IssueStatus)) {
      targetStatus = over.id as IssueStatus;
    } else {
      // It's a card — find which column it's in
      const targetIssue = issues.find((i) => i.id === over.id);
      if (targetIssue) {
        targetStatus = targetIssue.status;
      }
    }

    if (targetStatus && targetStatus !== issue.status) {
      updateStatusMutation.mutate({ issueId, status: targetStatus });
    }
  }

  return (
    <div className="border-t border-white/10 bg-[#070a11]">
      {/* Header with collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label="Kanban"
        className="flex w-full items-center gap-2 px-5 py-3 hover:bg-[#0c1017] transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
        <Columns3 className="h-4 w-4 text-blue-300" />
        <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
          Kanban
        </span>
        <span className="ml-auto text-xs text-muted-foreground/60 tabular-nums">
          {issues.length} issues
        </span>
      </button>

      {/* Board content */}
      {!collapsed && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto overflow-y-hidden bg-[#05070c] px-5 pb-4">
            <div className="flex gap-3 min-w-max">
              {BOARD_STATUSES.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  issues={columnIssues[status] ?? []}
                  agentMap={agentMap}
                />
              ))}
            </div>
          </div>
          <DragOverlay>
            {activeIssue ? (
              <KanbanCard issue={activeIssue} agentMap={agentMap} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
