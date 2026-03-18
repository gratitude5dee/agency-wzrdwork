import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "./useActiveCompany";

function isMissingTable(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || (error.message ?? "").includes("does not exist");
}

/**
 * Total agent count + breakdown by status, scoped to the active company.
 * Returns zero counts when no company is resolved.
 */
export function useAgentMetrics() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-agent-metrics", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("status")
        .eq("company_id", companyId!);

      if (error) {
        if (isMissingTable(error)) return { total: 0, running: 0, active: 0 };
        throw error;
      }

      const rows = (data ?? []) as { status: string }[];
      return {
        total: rows.length,
        running: rows.filter((r) => r.status === "running").length,
        active: rows.filter((r) => r.status === "active").length,
      };
    },
    refetchInterval: 15_000,
  });
}

/**
 * Open issue count + breakdown, scoped to the active company.
 * Returns zero counts when no company is resolved.
 */
export function useIssueMetrics() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-issue-metrics", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("status")
        .eq("company_id", companyId!)
        .not("status", "in", '("done","cancelled")');

      if (error) {
        if (isMissingTable(error)) return { open: 0, inProgress: 0, blocked: 0 };
        throw error;
      }

      const rows = (data ?? []) as { status: string }[];
      return {
        open: rows.length,
        inProgress: rows.filter((r) => r.status === "in_progress").length,
        blocked: rows.filter((r) => r.status === "blocked").length,
      };
    },
    refetchInterval: 15_000,
  });
}

/**
 * Live run count + outcome breakdown, scoped to the active company.
 * Returns zero counts when no company is resolved.
 */
export function useRunMetrics() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-run-metrics", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("runs")
        .select("status")
        .eq("company_id", companyId!);

      if (error) {
        if (isMissingTable(error)) return { live: 0, succeeded: 0, failed: 0 };
        throw error;
      }

      const rows = (data ?? []) as { status: string }[];
      return {
        live: rows.filter((r) => r.status === "running" || r.status === "queued").length,
        succeeded: rows.filter((r) => r.status === "succeeded").length,
        failed: rows.filter((r) => r.status === "failed").length,
      };
    },
    refetchInterval: 15_000,
  });
}

/**
 * Pending approval count, scoped to the active company.
 * Returns 0 when no company is resolved.
 */
export function useApprovalMetrics() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["dashboard-approval-metrics", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("approvals")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!)
        .eq("status", "pending");

      if (error) {
        if (isMissingTable(error)) return 0;
        throw error;
      }

      return count ?? 0;
    },
    refetchInterval: 15_000,
  });
}
