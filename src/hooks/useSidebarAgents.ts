import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "./useActiveCompany";

export interface SidebarAgent {
  id: string;
  name: string;
}

/**
 * Fetches agent id and name from Supabase for the sidebar agent list,
 * scoped to the active company. Polls every 30 seconds to pick up
 * newly created agents.
 */
export function useSidebarAgents() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["sidebar-agents", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async (): Promise<SidebarAgent[]> => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: true });

      if (error) {
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          return [];
        }
        throw error;
      }

      return (data ?? []) as SidebarAgent[];
    },
    refetchInterval: 30_000,
  });
}
