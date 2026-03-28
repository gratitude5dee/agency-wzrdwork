import { useDashboardOverviewQuery } from "./useDashboardData";

export function useAgentMetrics() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.metrics.agents ?? { total: 0, running: 0, active: 0 },
  };
}

export function useIssueMetrics() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.metrics.issues ?? { open: 0, inProgress: 0, blocked: 0 },
  };
}

export function useRunMetrics() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.metrics.runs ?? { live: 0, succeeded: 0, failed: 0 },
  };
}

export function useApprovalMetrics() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.metrics.approvals.pending ?? 0,
  };
}
