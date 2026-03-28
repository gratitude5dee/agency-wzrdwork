import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, heartbeatRuns } from "@paperclipai/db";
import type { Sql as PostgresSql } from "postgres";

const ACTIONABLE_APPROVAL_STATUSES = ["pending", "revision_requested"];
const FAILED_HEARTBEAT_STATUSES = ["failed", "timed_out"];

export function sidebarBadgeService(db: Db) {
  return {
    get: async (
      companyId: string,
      extra?: { joinRequests?: number; unreadTouchedIssues?: number },
    ) => {
      const actionableApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(
          and(
            eq(approvals.companyId, companyId),
            inArray(approvals.status, ACTIONABLE_APPROVAL_STATUSES),
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      const latestRunByAgent = await db
        .selectDistinctOn([heartbeatRuns.agentId], {
          runStatus: heartbeatRuns.status,
        })
        .from(heartbeatRuns)
        .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            eq(agents.companyId, companyId),
            not(eq(agents.status, "terminated")),
          ),
        )
        .orderBy(heartbeatRuns.agentId, desc(heartbeatRuns.createdAt));

      const failedRuns = latestRunByAgent.filter((row) =>
        FAILED_HEARTBEAT_STATUSES.includes(row.runStatus),
      ).length;

      const joinRequests = extra?.joinRequests ?? 0;
      const unreadTouchedIssues = extra?.unreadTouchedIssues ?? 0;

      return {
        inbox: actionableApprovals + failedRuns + joinRequests + unreadTouchedIssues,
        approvals: actionableApprovals,
        failedRuns,
        joinRequests,
      };
    },
  };
}

export async function getSidebarBadges(sqlClient: PostgresSql, companyId: string) {
  const [approvalRows, runRows] = await Promise.all([
    sqlClient<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM public.approvals
      WHERE company_id = ${companyId}::uuid
        AND status IN ('pending', 'revision_requested')
    `,
    sqlClient<Array<{ count: number }>>`
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
