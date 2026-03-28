import type { Database as DB } from "@/integrations/supabase/types";
import { requestServerJson, type ServerActorContext } from "./http";

export type IntegrationRecord = DB["public"]["Tables"]["integrations"]["Row"];

export async function listCompanyIntegrations(
  input: ServerActorContext & { companyId: string },
): Promise<IntegrationRecord[]> {
  const search = new URLSearchParams({ companyId: input.companyId });
  const data = await requestServerJson<{ integrations: IntegrationRecord[] }>(
    `/api/integrations?${search.toString()}`,
    {
      actor: input,
    },
  );
  return data.integrations;
}

export async function upsertIntegrationRecord(
  input: ServerActorContext & {
    companyId: string;
    integrationKey: string;
    name?: string | null;
    enabled?: boolean;
    config?: Record<string, unknown>;
  },
): Promise<IntegrationRecord> {
  const data = await requestServerJson<{ integration: IntegrationRecord }>(
    `/api/integrations/${input.integrationKey}`,
    {
      method: "PATCH",
      actor: input,
      body: {
        companyId: input.companyId,
        name: input.name ?? null,
        enabled: input.enabled,
        config: input.config,
      },
    },
  );

  return data.integration;
}
