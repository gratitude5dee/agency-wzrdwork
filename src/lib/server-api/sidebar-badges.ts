import { requestServerJson, type ServerActorContext } from "./http";

export interface SidebarBadges {
  inbox: number;
  approvals: number;
  failedRuns: number;
  joinRequests: number;
}

export async function getSidebarBadges(
  input: ServerActorContext & { companyId: string },
): Promise<SidebarBadges> {
  return await requestServerJson<SidebarBadges>(
    `/api/companies/${encodeURIComponent(input.companyId)}/sidebar-badges`,
    {
      method: "GET",
      actor: input,
    },
  );
}
