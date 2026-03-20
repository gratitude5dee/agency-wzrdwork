import type { Sql } from "postgres";

interface InstanceSettingsRow {
  id: string;
  singleton_key: string;
  experimental: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function normalizeExperimental(input: Record<string, unknown> | null | undefined) {
  return {
    enableIsolatedWorkspaces: input?.enableIsolatedWorkspaces === true,
  };
}

async function getOrCreateRow(sql: Sql) {
  const existing = await sql<InstanceSettingsRow[]>`
    SELECT id, singleton_key, experimental, created_at, updated_at
    FROM public.instance_settings
    WHERE singleton_key = 'default'
    LIMIT 1
  `;

  if (existing[0]) {
    return existing[0];
  }

  const created = await sql<InstanceSettingsRow[]>`
    INSERT INTO public.instance_settings (singleton_key, experimental)
    VALUES ('default', '{}'::jsonb)
    RETURNING id, singleton_key, experimental, created_at, updated_at
  `;

  return created[0];
}

export async function getInstanceExperimentalSettings(sql: Sql) {
  const row = await getOrCreateRow(sql);
  return normalizeExperimental(row.experimental);
}

export async function updateInstanceExperimentalSettings(
  sql: Sql,
  patch: { enableIsolatedWorkspaces?: boolean },
) {
  const current = await getOrCreateRow(sql);
  const next = normalizeExperimental({
    ...current.experimental,
    ...patch,
  });

  const rows = await sql<InstanceSettingsRow[]>`
    UPDATE public.instance_settings
    SET experimental = ${JSON.stringify(next)}::jsonb
    WHERE id = ${current.id}::uuid
    RETURNING id, singleton_key, experimental, created_at, updated_at
  `;

  return normalizeExperimental(rows[0]?.experimental);
}

export async function listInstanceSettingsCompanyIds(sql: Sql) {
  const rows = await sql<Array<{ id: string }>>`
    SELECT id
    FROM public.companies
    ORDER BY created_at ASC
  `;
  return rows.map((row) => row.id);
}
