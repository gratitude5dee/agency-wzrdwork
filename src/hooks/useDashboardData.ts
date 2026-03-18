/**
 * Dedicated Supabase-backed hooks for dashboard chart and panel data.
 * Each hook is company-scoped via useActiveCompany and returns data
 * suitable for direct consumption by dashboard panels and charts.
 *
 * These complement useDashboardMetrics (which provides aggregate counts)
 * by providing the underlying rows needed for charts, active-agent panels,
 * urgent-issue panels, and recent-activity feeds.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "./useActiveCompany";

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || (error.message ?? "").includes("does not exist");
}

/* ------------------------------------------------------------------ */
/*  Runs — for RunActivityChart and SuccessRateChart                  */
/* ------------------------------------------------------------------ */

export interface DashboardRunRow {
  id: string;
  status: string;
  created_at: string;
}

export function useDashboardRuns() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-runs", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async (): Promise<DashboardRunRow[]> => {
      const { data, error } = await supabase
        .from("runs")
        .select("id, status, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }

      return (data ?? []) as DashboardRunRow[];
    },
    refetchInterval: 15_000,
  });
}

/* ------------------------------------------------------------------ */
/*  Issues — for PriorityChart, IssueStatusChart, and urgent panel    */
/* ------------------------------------------------------------------ */

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
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-issues", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async (): Promise<DashboardIssueRow[]> => {
      const { data, error } = await supabase
        .from("issues")
        .select("id, identifier, title, status, priority, assignee_agent_id, created_at, updated_at")
        .eq("company_id", companyId!)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }

      return (data ?? []) as DashboardIssueRow[];
    },
    refetchInterval: 15_000,
  });
}

/* ------------------------------------------------------------------ */
/*  Agents — for ActiveAgentsPanel                                    */
/* ------------------------------------------------------------------ */

export interface DashboardAgentRow {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
}

export function useDashboardAgents() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-agents", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async (): Promise<DashboardAgentRow[]> => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, role, title, status, adapter_type")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }

      return (data ?? []) as DashboardAgentRow[];
    },
    refetchInterval: 15_000,
  });
}

/* ------------------------------------------------------------------ */
/*  Activity — for Recent Activity panel                              */
/* ------------------------------------------------------------------ */

export interface DashboardActivityRow {
  id: string;
  agent_id: string | null;
  issue_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

export function useDashboardActivity() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-activity", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async (): Promise<DashboardActivityRow[]> => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("id, agent_id, issue_id, action, details, created_at")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        if (isMissingTable(error)) return [];
        throw error;
      }

      return (data ?? []) as DashboardActivityRow[];
    },
    refetchInterval: 10_000,
  });
}
