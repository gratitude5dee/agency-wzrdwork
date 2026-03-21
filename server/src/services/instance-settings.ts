import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, instanceSettings } from "@paperclipai/db";
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

export function instanceSettingsService(db: Db) {
  async function getOrCreateSettingsRow() {
    const existing = await db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.singletonKey, "default"))
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;

    const now = new Date();
    const [created] = await db
      .insert(instanceSettings)
      .values({
        singletonKey: "default",
        experimental: {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return created;
  }

  return {
    get: async () => {
      const row = await getOrCreateSettingsRow();
      return {
        id: row.id,
        experimental: normalizeExperimental(row.experimental as Record<string, unknown> | null),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    getExperimental: async () => {
      const row = await getOrCreateSettingsRow();
      return normalizeExperimental(row.experimental as Record<string, unknown> | null);
    },

    updateExperimental: async (patch: { enableIsolatedWorkspaces?: boolean }) => {
      const current = await getOrCreateSettingsRow();
      const nextExperimental = normalizeExperimental({
        ...(current.experimental as Record<string, unknown> | null | undefined),
        ...patch,
      });
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          experimental: { ...nextExperimental },
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();

      const row = updated ?? current;
      return {
        id: row.id,
        experimental: normalizeExperimental(row.experimental as Record<string, unknown> | null),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    listCompanyIds: async () =>
      db
        .select({ id: companies.id })
        .from(companies)
        .then((rows) => rows.map((row) => row.id)),
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
