import type { Sql } from "postgres";
import { HttpError, asString } from "../http.js";
import type { JsonObject } from "../types.js";

export interface IntegrationRow {
  id: string;
  company_id: string;
  integration_key: string;
  name: string | null;
  enabled: boolean | null;
  config: JsonObject | null;
  created_at: string;
  updated_at: string;
}

export async function listIntegrations(sql: Sql, companyId: string): Promise<IntegrationRow[]> {
  return sql<IntegrationRow[]>`
    SELECT id, company_id, integration_key, name, enabled, config, created_at, updated_at
    FROM public.integrations
    WHERE company_id = ${companyId}::uuid
    ORDER BY created_at ASC
  `;
}

export async function upsertIntegration(
  sql: Sql,
  input: {
    companyId: string;
    integrationKey: string;
    name?: string | null;
    enabled?: boolean;
    config?: JsonObject;
  },
): Promise<IntegrationRow> {
  const key = asString(input.integrationKey);
  if (!key) {
    throw new HttpError(400, "integrationKey is required");
  }

  const existing = await sql<{ id: string; config: JsonObject | null }[]>`
    SELECT id, config
    FROM public.integrations
    WHERE company_id = ${input.companyId}::uuid
      AND integration_key = ${key}
    LIMIT 1
  `;

  if (existing[0]) {
    const rows = await sql<IntegrationRow[]>`
      UPDATE public.integrations
      SET
        name = COALESCE(${input.name ?? null}, name),
        enabled = COALESCE(${input.enabled ?? null}, enabled),
        config = COALESCE(${input.config ? sql.json(input.config) : null}::jsonb, config),
        updated_at = now()
      WHERE id = ${existing[0].id}::uuid
      RETURNING id, company_id, integration_key, name, enabled, config, created_at, updated_at
    `;

    const row = rows[0];
    if (!row) throw new HttpError(500, "Failed to update integration");
    return row;
  }

  const rows = await sql<IntegrationRow[]>`
    INSERT INTO public.integrations (
      company_id,
      integration_key,
      name,
      enabled,
      config
    )
    VALUES (
      ${input.companyId}::uuid,
      ${key},
      ${input.name ?? key},
      ${input.enabled ?? false},
      ${sql.json(input.config ?? {})}::jsonb
    )
    RETURNING id, company_id, integration_key, name, enabled, config, created_at, updated_at
  `;

  const row = rows[0];
  if (!row) throw new HttpError(500, "Failed to create integration");
  return row;
}
