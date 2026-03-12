import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { DEMO_SNAPSHOT } from "./demoData";
import type {
  ActivityRecord,
  AgencySnapshot,
  AgentRecord,
  ApprovalRecord,
  CompanyRecord,
  CreateIssueInput,
  GoalRecord,
  IssueRecord,
  ProjectRecord,
  RunRecord,
} from "./domain";

const SNAPSHOT_QUERY_KEY = ["agency-snapshot"];

function mapCompanyRow(row: Record<string, any>): CompanyRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    companyType: row.company_type,
    description: row.description,
    brief: row.brief,
    brandColor: row.brand_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAgentRow(row: Record<string, any>): AgentRecord {
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

function mapProjectRow(row: Record<string, any>): ProjectRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    summary: row.summary,
    status: row.status,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGoalRow(row: Record<string, any>): GoalRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    ownerAgentId: row.owner_agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIssueRow(row: Record<string, any>): IssueRecord {
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

function mapApprovalRow(row: Record<string, any>): ApprovalRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    issueId: row.issue_id,
    requestedByAgentId: row.requested_by_agent_id,
    status: row.status,
    summary: row.summary,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function mapRunRow(row: Record<string, any>): RunRecord {
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
    totalInputTokens: row.total_input_tokens,
    totalOutputTokens: row.total_output_tokens,
    totalCachedInputTokens: row.total_cached_input_tokens,
    totalCostUsd:
      row.total_cost_usd === null || row.total_cost_usd === undefined
        ? null
        : Number(row.total_cost_usd),
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}

function mapActivityRow(row: Record<string, any>): ActivityRecord {
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

function isMissingSchemaError(error: { message?: string | null; code?: string | null } | null | undefined) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("schema")
  );
}

function createDemoIssue(snapshot: AgencySnapshot, input: CreateIssueInput): AgencySnapshot {
  const nextIndex = snapshot.issues.length + 1;
  const issueId = `issue-demo-${nextIndex}`;
  const identifier = `ACM-${nextIndex + 2}`;
  const now = new Date().toISOString();

  return {
    ...snapshot,
    issues: [
      {
        id: issueId,
        companyId: snapshot.company.id,
        projectId: input.projectId,
        assigneeAgentId: input.assigneeAgentId,
        identifier,
        title: input.title,
        description: input.description,
        status: "todo",
        priority: input.priority,
        createdAt: now,
        updatedAt: now,
      },
      ...snapshot.issues,
    ],
    activity: [
      {
        id: `activity-demo-${nextIndex}`,
        companyId: snapshot.company.id,
        agentId: input.assigneeAgentId,
        issueId,
        action: "issue.created",
        details: `Opened ${identifier}`,
        createdAt: now,
      },
      ...snapshot.activity,
    ],
  };
}

async function loadTable<T>(table: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table as never)
    .select("*");

  if (error) {
    throw error;
  }

  return [...((data ?? []) as T[])].sort((left: any, right: any) => {
    const leftTimestamp = new Date(left.updated_at ?? left.created_at ?? 0).getTime();
    const rightTimestamp = new Date(right.updated_at ?? right.created_at ?? 0).getTime();
    return rightTimestamp - leftTimestamp;
  });
}

export async function loadAgencySnapshot(): Promise<AgencySnapshot> {
  try {
    const companies = await loadTable<Record<string, any>>("companies");

    if (companies.length === 0) {
      return DEMO_SNAPSHOT;
    }

    const company = mapCompanyRow(companies[0]);

    const [agents, projects, goals, issues, approvals, runs, activity] = await Promise.all([
      loadTable<Record<string, any>>("agents"),
      loadTable<Record<string, any>>("projects"),
      loadTable<Record<string, any>>("goals"),
      loadTable<Record<string, any>>("issues"),
      loadTable<Record<string, any>>("approvals"),
      loadTable<Record<string, any>>("runs"),
      loadTable<Record<string, any>>("activity_events"),
    ]);

    return {
      company,
      agents: agents.map(mapAgentRow).filter((entry) => entry.companyId === company.id),
      projects: projects.map(mapProjectRow).filter((entry) => entry.companyId === company.id),
      goals: goals.map(mapGoalRow).filter((entry) => entry.companyId === company.id),
      issues: issues.map(mapIssueRow).filter((entry) => entry.companyId === company.id),
      approvals: approvals.map(mapApprovalRow).filter((entry) => entry.companyId === company.id),
      runs: runs.map(mapRunRow).filter((entry) => entry.companyId === company.id),
      activity: activity.map(mapActivityRow).filter((entry) => entry.companyId === company.id),
      source: "supabase",
    };
  } catch (error) {
    if (isMissingSchemaError(error as { message?: string; code?: string })) {
      return DEMO_SNAPSHOT;
    }

    return {
      ...DEMO_SNAPSHOT,
      sourceMessage:
        error instanceof Error
          ? error.message
          : "Supabase was unavailable, so the cockpit switched to demo data.",
    };
  }
}

export function useAgencyData() {
  const queryClient = useQueryClient();

  const snapshotQuery = useQuery({
    queryKey: SNAPSHOT_QUERY_KEY,
    queryFn: loadAgencySnapshot,
    refetchInterval: (query) => (query.state.data?.source === "supabase" ? 30_000 : false),
  });

  const createIssueMutation = useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const current = (queryClient.getQueryData(SNAPSHOT_QUERY_KEY) as AgencySnapshot | undefined) ?? DEMO_SNAPSHOT;

      if (current.source !== "supabase") {
        return createDemoIssue(current, input);
      }

      const identifier = `${current.company.slug.slice(0, 3).toUpperCase()}-${current.issues.length + 1}`;
      const { data, error } = await supabase
        .from("issues")
        .insert({
          company_id: current.company.id,
          project_id: input.projectId,
          assignee_agent_id: input.assigneeAgentId,
          identifier,
          title: input.title,
          description: input.description,
          status: "todo",
          priority: input.priority,
        })
        .select("*")
        .single();

      if (error) {
        return createDemoIssue(current, input);
      }

      await supabase.from("activity_events").insert({
        company_id: current.company.id,
        agent_id: input.assigneeAgentId,
        issue_id: (data as { id: string }).id,
        action: "issue.created",
        details: `Opened ${identifier}`,
      });

      return await loadAgencySnapshot();
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(SNAPSHOT_QUERY_KEY, snapshot);
    },
  });

  return {
    ...snapshotQuery,
    snapshot: snapshotQuery.data ?? DEMO_SNAPSHOT,
    createIssue: createIssueMutation.mutateAsync,
    isCreatingIssue: createIssueMutation.isPending,
  };
}
