import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useActiveCompany";
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

async function loadTable<T>(table: string, companyId?: string): Promise<T[]> {
  let query = supabase.from(table as never).select("*");

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return [...((data ?? []) as T[])].sort((left: any, right: any) => {
    const leftTimestamp = new Date(left.updated_at ?? left.created_at ?? 0).getTime();
    const rightTimestamp = new Date(right.updated_at ?? right.created_at ?? 0).getTime();
    return rightTimestamp - leftTimestamp;
  });
}

/**
 * Load the agency snapshot for a specific company.
 * When companyId is provided, all child tables are scoped to that company.
 * When companyId is null/undefined, falls back to demo data.
 */
export async function loadAgencySnapshot(companyId?: string | null): Promise<AgencySnapshot> {
  if (!companyId) {
    return DEMO_SNAPSHOT;
  }

  try {
    // Load the company by its resolved ID
    const { data: companyRow, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    if (companyError) {
      if (isMissingSchemaError(companyError)) return DEMO_SNAPSHOT;
      throw companyError;
    }

    if (!companyRow) {
      return DEMO_SNAPSHOT;
    }

    const company = mapCompanyRow(companyRow);

    const [agents, projects, goals, issues, approvals, runs, activity] = await Promise.all([
      loadTable<Record<string, any>>("agents", company.id),
      loadTable<Record<string, any>>("projects", company.id),
      loadTable<Record<string, any>>("goals", company.id),
      loadTable<Record<string, any>>("issues", company.id),
      loadTable<Record<string, any>>("approvals", company.id),
      loadTable<Record<string, any>>("runs", company.id),
      loadTable<Record<string, any>>("activity_events", company.id),
    ]);

    return {
      company,
      agents: agents.map(mapAgentRow),
      projects: projects.map(mapProjectRow),
      goals: goals.map(mapGoalRow),
      issues: issues.map(mapIssueRow),
      approvals: approvals.map(mapApprovalRow),
      runs: runs.map(mapRunRow),
      activity: activity.map(mapActivityRow),
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
          : "The backend was unavailable, so the sandbox switched to demo data.",
    };
  }
}

export function useAgencyData() {
  const queryClient = useQueryClient();
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  const snapshotQueryKey = [...SNAPSHOT_QUERY_KEY, companyId] as const;

  const snapshotQuery = useQuery({
    queryKey: snapshotQueryKey,
    queryFn: () => loadAgencySnapshot(companyId),
    enabled: !companyLoading,
    refetchInterval: (query) => (query.state.data?.source === "supabase" ? 10_000 : false),
  });

  const createIssueMutation = useMutation({
    mutationFn: async (input: CreateIssueInput) => {
      const current = (queryClient.getQueryData(snapshotQueryKey) as AgencySnapshot | undefined) ?? DEMO_SNAPSHOT;

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

      return await loadAgencySnapshot(companyId);
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(snapshotQueryKey, snapshot);
    },
  });

  return {
    ...snapshotQuery,
    snapshot: snapshotQuery.data ?? DEMO_SNAPSHOT,
    createIssue: createIssueMutation.mutateAsync,
    isCreatingIssue: createIssueMutation.isPending,
  };
}
