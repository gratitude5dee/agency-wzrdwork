import type { Sql } from "postgres";

export async function getSidebarBadges(sql: Sql, companyId: string) {
  const [approvalRows, runRows] = await Promise.all([
    sql<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM public.approvals
      WHERE company_id = ${companyId}::uuid
        AND status IN ('pending', 'revision_requested')
    `,
    sql<Array<{ count: number }>>`
      WITH latest_runs AS (
        SELECT DISTINCT ON (agent_id)
          agent_id,
          status
        FROM public.heartbeat_runs
        WHERE company_id = ${companyId}::uuid
        ORDER BY agent_id, created_at DESC
      )
      SELECT count(*)::int AS count
      FROM latest_runs
      WHERE status IN ('failed', 'timed_out')
    `,
  ]);

  const approvals = Number(approvalRows[0]?.count ?? 0);
  const failedRuns = Number(runRows[0]?.count ?? 0);
  const joinRequests = 0;

  return {
    inbox: approvals + failedRuns + joinRequests,
    approvals,
    failedRuns,
    joinRequests,
  };
}
