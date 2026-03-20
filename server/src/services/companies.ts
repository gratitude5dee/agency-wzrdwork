import type { Sql } from "postgres";
import { HttpError } from "../http.js";

export interface CompanySettingsRow {
  id: string;
  name: string;
  wallet_address: string | null;
  company_type: string | null;
  brand_color: string | null;
  brief: string | null;
  slug: string | null;
  description: string | null;
  created_at: string | null;
}

export async function getCompanySettings(
  sql: Sql,
  companyId: string,
): Promise<CompanySettingsRow | null> {
  const rows = await sql<CompanySettingsRow[]>`
    SELECT id, name, wallet_address, company_type, brand_color, brief, slug, description, created_at
    FROM public.companies
    WHERE id = ${companyId}::uuid
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function updateCompanySettings(
  sql: Sql,
  companyId: string,
  patch: {
    name?: string | null;
    brief?: string | null;
    company_type?: string | null;
    brand_color?: string | null;
  },
): Promise<CompanySettingsRow> {
  const rows = await sql<CompanySettingsRow[]>`
    UPDATE public.companies
    SET
      name = COALESCE(${patch.name ?? null}, name),
      brief = COALESCE(${patch.brief ?? null}, brief),
      company_type = COALESCE(${patch.company_type ?? null}, company_type),
      brand_color = COALESCE(${patch.brand_color ?? null}, brand_color)
    WHERE id = ${companyId}::uuid
    RETURNING id, name, wallet_address, company_type, brand_color, brief, slug, description, created_at
  `;

  const row = rows[0];
  if (!row) {
    throw new HttpError(404, "Company not found");
  }
  return row;
}
