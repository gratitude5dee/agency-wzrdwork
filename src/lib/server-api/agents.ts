import { requestServerJson, requestServerVoid, type ServerActorContext } from "./http";

export interface AgentListRecord {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
  reports_to: string | null;
  company_id: string;
  created_at: string;
}

export interface AgentDetailRecord {
  agent: {
    company_id: string;
    id: string;
    name: string;
    role: string;
    title: string | null;
    status: string;
    adapter_type: string;
    adapter_config: Record<string, unknown> | null;
    capabilities: string | null;
    reports_to: string | null;
    seat_index: number;
    private_cognition_enabled: boolean;
    venice_model: string | null;
    created_at: string;
    updated_at: string;
  };
  issues: Array<{
    id: string;
    identifier: string | null;
    title: string;
    status: string;
    priority: string;
  }>;
  runs: Array<{
    id: string;
    status: string;
    summary: string | null;
    created_at: string;
    total_cost_usd: number | null;
  }>;
}

export async function listAgentRecords(
  input: ServerActorContext & { companyId: string },
): Promise<AgentListRecord[]> {
  const data = await requestServerJson<{ agents: AgentListRecord[] }>(
    `/api/agents?companyId=${encodeURIComponent(input.companyId)}`,
    {
      method: "GET",
      actor: input,
    },
  );
  return data.agents ?? [];
}

export async function getAgentDetailRecord(
  input: ServerActorContext & { agentId: string; companyId?: string | null },
): Promise<AgentDetailRecord> {
  return await requestServerJson<AgentDetailRecord>(`/api/agents/${input.agentId}`, {
    method: "GET",
    actor: input,
  });
}

export async function createAgentRecord(input: ServerActorContext & {
  companyId: string;
  name: string;
  title?: string | null;
  role: string;
  reportsTo?: string | null;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  selectedSkillIds?: string[];
  integrationIds?: string[];
}): Promise<{ id: string }> {
  return requestServerJson<{ id: string }>("/api/agents", {
    method: "POST",
    actor: input,
    body: {
      companyId: input.companyId,
      name: input.name,
      title: input.title ?? null,
      role: input.role,
      reportsTo: input.reportsTo ?? null,
      adapterType: input.adapterType,
      adapterConfig: input.adapterConfig,
      selectedSkillIds: input.selectedSkillIds ?? [],
      integrationIds: input.integrationIds ?? [],
    },
  });
}

export async function updateAgentRecord(input: ServerActorContext & {
  agentId: string;
  privateCognitionEnabled?: boolean;
  veniceModel?: string | null;
}): Promise<void> {
  await requestServerVoid(`/api/agents/${input.agentId}`, {
    method: "PATCH",
    actor: input,
    body: {
      privateCognitionEnabled: input.privateCognitionEnabled,
      veniceModel: input.veniceModel,
    },
  });
}
