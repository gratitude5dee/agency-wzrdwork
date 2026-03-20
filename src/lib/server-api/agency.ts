import { requestServerJson, type ServerActorContext } from "./http";
import type { AgencySnapshot } from "@/features/cockpit/lib/domain";

export async function getAgencySnapshotRecord(
  input: ServerActorContext & { companyId: string },
): Promise<AgencySnapshot> {
  return await requestServerJson<AgencySnapshot>(
    `/api/agency/snapshot?companyId=${encodeURIComponent(input.companyId)}`,
    {
      method: "GET",
      actor: input,
    },
  );
}

export async function listActivityRecords(
  input: ServerActorContext & { companyId: string; limit?: number | null },
): Promise<Array<{
  id: string;
  company_id: string;
  agent_id: string | null;
  issue_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}>> {
  const params = new URLSearchParams({ companyId: input.companyId });
  if (input.limit) params.set("limit", String(input.limit));

  const data = await requestServerJson<{
    activity: Array<{
      id: string;
      company_id: string;
      agent_id: string | null;
      issue_id: string | null;
      action: string;
      details: string | null;
      created_at: string;
    }>;
  }>(`/api/activity?${params.toString()}`, {
    method: "GET",
    actor: input,
  });

  return data.activity ?? [];
}
