import { useQuery } from "@tanstack/react-query";
import { getSidebarBadges, type SidebarBadges } from "@/lib/server-api/sidebar-badges";
import { useActiveCompany } from "./useActiveCompany";

export function useSidebarBadges() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery<SidebarBadges>({
    queryKey: ["sidebar-badges", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: () => getSidebarBadges({ companyId: companyId! }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
