/**
 * Issue → Runtime Crossflow Trace (VAL-CROSS-003)
 *
 * Given an issue ID, traces the coherent execution trail across:
 * - Issue record (issues table)
 * - Activity events linked to the issue
 * - Runs linked to the issue
 * - Execution logs for linked runs
 * - Approvals linked to the issue
 *
 * Every artifact in the trail shares the same issue_id, company_id,
 * and (where applicable) agent_id, so a validator or UI can prove
 * end-to-end coherence without hidden manual correlation.
 */

import { supabase } from "@/integrations/supabase/client";

/* ================================================================
   Types
   ================================================================ */

export interface IssueRuntimeTrace {
  /** The issue that anchors this crossflow */
  issue: {
    id: string;
    identifier: string;
    title: string;
    status: string;
    priority: string;
    company_id: string;
    assignee_agent_id: string | null;
    project_id: string | null;
  } | null;

  /** Activity events linked to this issue */
  activityEvents: Array<{
    id: string;
    action: string;
    details: string | null;
    agent_id: string | null;
    company_id: string;
    issue_id: string;
    created_at: string;
  }>;

  /** Runs linked to this issue */
  runs: Array<{
    id: string;
    agent_id: string;
    company_id: string;
    status: string;
    summary: string | null;
    issue_id: string;
    created_at: string;
    finished_at: string | null;
  }>;

  /** Execution logs for runs linked to this issue */
  executionLogs: Array<{
    id: string;
    agent_id: string;
    company_id: string;
    run_id: string;
    log_type: string;
    content: unknown;
    created_at: string;
  }>;

  /** Approvals linked to this issue */
  approvals: Array<{
    id: string;
    company_id: string;
    requested_by_agent_id: string;
    issue_id: string;
    status: string;
    summary: string | null;
    created_at: string;
  }>;

  /** Whether all artifacts share coherent identifiers */
  coherent: boolean;

  /** Specific coherence violations found */
  violations: string[];
}

/* ================================================================
   Trace Function
   ================================================================ */

/**
 * Trace the full issue → runtime crossflow for an issue ID.
 *
 * Returns every linked artifact and validates that all share
 * consistent company_id and issue_id references.
 */
export async function traceIssueRuntime(issueId: string): Promise<IssueRuntimeTrace> {
  const violations: string[] = [];

  // 1. Fetch the issue
  const { data: issue } = await supabase
    .from("issues")
    .select("id, identifier, title, status, priority, company_id, assignee_agent_id, project_id")
    .eq("id", issueId)
    .maybeSingle();

  if (!issue) {
    return {
      issue: null,
      activityEvents: [],
      runs: [],
      executionLogs: [],
      approvals: [],
      coherent: false,
      violations: [`Issue ${issueId} not found`],
    };
  }

  const companyId = issue.company_id;

  // 2. Fetch activity events for this issue
  const { data: activityEvents = [] } = await supabase
    .from("activity_events")
    .select("id, action, details, agent_id, company_id, issue_id, created_at")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  // 3. Fetch runs linked to this issue
  const { data: runs = [] } = await supabase
    .from("runs")
    .select("id, agent_id, company_id, status, summary, issue_id, created_at, finished_at")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  // 4. Fetch execution logs for all runs linked to this issue
  const runIds = (runs ?? []).map((r) => r.id);
  let executionLogs: IssueRuntimeTrace["executionLogs"] = [];
  if (runIds.length > 0) {
    const { data: logs = [] } = await supabase
      .from("agent_execution_logs")
      .select("id, agent_id, company_id, run_id, log_type, content, created_at")
      .in("run_id", runIds)
      .order("created_at", { ascending: true });
    executionLogs = logs ?? [];
  }

  // 5. Fetch approvals linked to this issue
  const { data: approvals = [] } = await supabase
    .from("approvals")
    .select("id, company_id, requested_by_agent_id, issue_id, status, summary, created_at")
    .eq("issue_id", issueId)
    .order("created_at", { ascending: true });

  // 6. Validate coherence — all artifacts must share company_id
  for (const evt of activityEvents ?? []) {
    if (evt.company_id !== companyId) {
      violations.push(
        `Activity event ${evt.id} has company_id ${evt.company_id}, expected ${companyId}`,
      );
    }
    if (evt.issue_id !== issueId) {
      violations.push(
        `Activity event ${evt.id} has issue_id ${evt.issue_id}, expected ${issueId}`,
      );
    }
  }

  for (const run of runs ?? []) {
    if (run.company_id !== companyId) {
      violations.push(
        `Run ${run.id} has company_id ${run.company_id}, expected ${companyId}`,
      );
    }
    if (run.issue_id !== issueId) {
      violations.push(
        `Run ${run.id} has issue_id ${run.issue_id}, expected ${issueId}`,
      );
    }
  }

  for (const log of executionLogs) {
    if (log.company_id !== companyId) {
      violations.push(
        `Execution log ${log.id} has company_id ${log.company_id}, expected ${companyId}`,
      );
    }
  }

  for (const approval of approvals ?? []) {
    if (approval.company_id !== companyId) {
      violations.push(
        `Approval ${approval.id} has company_id ${approval.company_id}, expected ${companyId}`,
      );
    }
    if (approval.issue_id !== issueId) {
      violations.push(
        `Approval ${approval.id} has issue_id ${approval.issue_id}, expected ${issueId}`,
      );
    }
  }

  return {
    issue,
    activityEvents: activityEvents ?? [],
    runs: runs ?? [],
    executionLogs,
    approvals: approvals ?? [],
    coherent: violations.length === 0,
    violations,
  };
}
