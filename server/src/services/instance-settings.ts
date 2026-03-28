import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies, instanceSettings } from "@paperclipai/db";
import {
  instanceGeneralSettingsSchema,
  type InstanceGeneralSettings,
  instanceExperimentalSettingsSchema,
  type InstanceExperimentalSettings,
  type PatchInstanceGeneralSettings,
  type PatchInstanceExperimentalSettings,
} from "@paperclipai/shared";
import type { Sql } from "postgres";

interface InstanceSettingsRow {
  id: string;
  singleton_key: string;
  general: Record<string, unknown> | null;
  experimental: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface InstanceSettingsResult {
  id: string;
  general: InstanceGeneralSettings;
  experimental: InstanceExperimentalSettings;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeGeneral(input: unknown): InstanceGeneralSettings {
  const parsed = instanceGeneralSettingsSchema.safeParse(input ?? {});
  if (parsed.success) {
    return { censorUsernameInLogs: parsed.data.censorUsernameInLogs ?? false };
  }
  return { censorUsernameInLogs: false };
}

function normalizeExperimental(input: unknown): InstanceExperimentalSettings {
  const parsed = instanceExperimentalSettingsSchema.safeParse(input ?? {});
  if (parsed.success) {
    return {
      enableIsolatedWorkspaces: parsed.data.enableIsolatedWorkspaces ?? false,
      autoRestartDevServerWhenIdle: parsed.data.autoRestartDevServerWhenIdle ?? false,
    };
  }
  return { enableIsolatedWorkspaces: false, autoRestartDevServerWhenIdle: false };
}

function toResult(row: typeof instanceSettings.$inferSelect): InstanceSettingsResult {
  return {
    id: row.id,
    general: normalizeGeneral(row.general),
    experimental: normalizeExperimental(row.experimental),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
        general: {},
        experimental: {},
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [instanceSettings.singletonKey],
        set: { updatedAt: now },
      })
      .returning();

    return created;
  }

  return {
    get: async (): Promise<InstanceSettingsResult> => toResult(await getOrCreateSettingsRow()),

    getGeneral: async (): Promise<InstanceGeneralSettings> => {
      const row = await getOrCreateSettingsRow();
      return normalizeGeneral(row.general);
    },

    getExperimental: async (): Promise<InstanceExperimentalSettings> => {
      const row = await getOrCreateSettingsRow();
      return normalizeExperimental(row.experimental);
    },

    updateGeneral: async (patch: PatchInstanceGeneralSettings): Promise<InstanceSettingsResult> => {
      const current = await getOrCreateSettingsRow();
      const nextGeneral = normalizeGeneral({
        ...normalizeGeneral(current.general),
        ...patch,
      });
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          general: { ...nextGeneral },
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toResult(updated ?? current);
    },

    updateExperimental: async (patch: PatchInstanceExperimentalSettings): Promise<InstanceSettingsResult> => {
      const current = await getOrCreateSettingsRow();
      const nextExperimental = normalizeExperimental({
        ...normalizeExperimental(current.experimental),
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
      return toResult(updated ?? current);
    },

    listCompanyIds: async (): Promise<string[]> =>
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
