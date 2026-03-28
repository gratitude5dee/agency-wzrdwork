import { useQuery } from "@tanstack/react-query";
import { listAgentRecords } from "@/lib/server-api/agents";
import { useActiveCompany } from "./useActiveCompany";

export interface SidebarAgent {
  id: string;
  name: string;
}

export function useSidebarAgents() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery({
    queryKey: ["sidebar-agents", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async (): Promise<SidebarAgent[]> => {
      const agents = await listAgentRecords({ companyId: companyId! });
      return agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
      }));
    },
    refetchInterval: 30_000,
  });
}
