import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "./useActiveCompany";

/**
 * Returns the count of approvals with status "pending" from Supabase,
 * scoped to the active company. Polls every 15 seconds to keep the sidebar
 * badge up-to-date.
 */
export function usePendingApprovalCount() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["pending-approval-count", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("approvals")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId!)
        .eq("status", "pending");

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          return 0;
        }
        throw error;
      }

      return count ?? 0;
    },
    refetchInterval: 15_000,
  });
}
