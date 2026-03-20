import { requestServerJson, type ServerActorContext } from "./http";

export interface CompanySettingsRecord {
  id: string;
  name: string;
  wallet_address: string | null;
  company_type?: string | null;
  brand_color?: string | null;
  brief?: string | null;
  slug?: string | null;
  description?: string | null;
  created_at?: string | null;
}

export async function getCompanySettingsRecord(
  input: ServerActorContext & { companyId: string },
): Promise<CompanySettingsRecord | null> {
  const data = await requestServerJson<{ company: CompanySettingsRecord }>(
    `/api/companies/${input.companyId}`,
    { actor: input },
  );

  return data.company ?? null;
}

export async function updateCompanySettingsRecord(
  input: ServerActorContext & {
    companyId: string;
    patch: Partial<Pick<CompanySettingsRecord, "name" | "brief" | "company_type" | "brand_color">>;
  },
): Promise<CompanySettingsRecord> {
  const data = await requestServerJson<{ company: CompanySettingsRecord }>(
    `/api/companies/${input.companyId}`,
    {
      method: "PATCH",
      actor: input,
      body: input.patch,
    },
  );

  return data.company;
}
