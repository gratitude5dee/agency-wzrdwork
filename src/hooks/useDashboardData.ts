import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview, type DashboardOverview } from "@/lib/server-api/dashboard";
import { useActiveCompany } from "./useActiveCompany";

function useDashboardOverviewQuery() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery<DashboardOverview>({
    queryKey: ["dashboard-overview", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: () => getDashboardOverview({ companyId: companyId! }),
    refetchInterval: 15_000,
  });
}

export interface DashboardRunRow {
  id: string;
  status: string;
  created_at: string;
  summary: string | null;
  total_cost_usd: number | null;
}

export function useDashboardRuns() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.latestRuns ?? [],
  };
}

export interface DashboardIssueRow {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  priority: string;
  assignee_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useDashboardIssues() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.urgentIssues ?? [],
  };
}

export interface DashboardAgentRow {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
}

export function useDashboardAgents() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.agentRows ?? [],
  };
}

export interface DashboardActivityRow {
  id: string;
  agent_id: string | null;
  issue_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export function useDashboardActivity() {
  const overviewQuery = useDashboardOverviewQuery();
  return {
    ...overviewQuery,
    data: overviewQuery.data?.recentActivity ?? [],
  };
}

export { useDashboardOverviewQuery };
