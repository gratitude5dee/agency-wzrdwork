import { requestServerJson, type ServerActorContext } from "./http";

export interface DashboardOverview {
  metrics: {
    agents: { total: number; running: number; active: number };
    issues: { open: number; inProgress: number; blocked: number };
    runs: { live: number; succeeded: number; failed: number };
    approvals: { pending: number };
  };
  latestRuns: Array<{
    id: string;
    status: string;
    created_at: string;
    summary: string | null;
    total_cost_usd: number | null;
  }>;
  urgentIssues: Array<{
    id: string;
    identifier: string | null;
    title: string;
    status: string;
    priority: string;
    assignee_agent_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  agentRows: Array<{
    id: string;
    name: string;
    role: string;
    title: string | null;
    status: string;
    adapter_type: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    company_id: string;
    issue_id: string | null;
    requested_by_agent_id: string | null;
    status: string;
    summary: string;
    details: string | null;
    resolution_note: string | null;
    created_at: string;
    resolved_at: string | null;
  }>;
  recentActivity: Array<{
    id: string;
    agent_id: string | null;
    issue_id: string | null;
    action: string;
    details: string | null;
    created_at: string;
  }>;
}

export async function getDashboardOverview(
  input: ServerActorContext & { companyId: string },
): Promise<DashboardOverview> {
  return await requestServerJson<DashboardOverview>(
    `/api/dashboard/overview?companyId=${encodeURIComponent(input.companyId)}`,
    {
      method: "GET",
      actor: input,
    },
  );
}
