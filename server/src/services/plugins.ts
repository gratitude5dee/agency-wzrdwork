import type { ParameterOrJSON, Sql } from "postgres";
import { HttpError } from "../http.js";
import type { JsonObject } from "../types.js";

export interface CompanyPluginRecord {
  id: string;
  installation_id: string;
  company_id: string;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  package_name: string | null;
  entrypoint: string | null;
  manifest: JsonObject;
  status: string;
  enabled: boolean;
  config: JsonObject;
  created_at: string;
  updated_at: string;
}

interface CompanyPluginRow extends CompanyPluginRecord {}

const COMPANY_PLUGIN_SELECT = `
  SELECT
    p.id,
    cp.id AS installation_id,
    cp.company_id,
    p.slug,
    p.name,
    p.version,
    p.description,
    p.package_name,
    p.entrypoint,
    p.manifest,
    cp.status,
    cp.enabled,
    cp.config,
    cp.created_at,
    cp.updated_at
  FROM public.company_plugins cp
  INNER JOIN public.plugins p ON p.id = cp.plugin_id
`;

function normalizeJsonObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonObject;
}

export async function listCompanyPlugins(sql: Sql, companyId: string) {
  const rows = await sql<CompanyPluginRow[]>`
    SELECT
      p.id,
      cp.id AS installation_id,
      cp.company_id,
      p.slug,
      p.name,
      p.version,
      p.description,
      p.package_name,
      p.entrypoint,
      p.manifest,
      cp.status,
      cp.enabled,
      cp.config,
      cp.created_at,
      cp.updated_at
    FROM public.company_plugins cp
    INNER JOIN public.plugins p ON p.id = cp.plugin_id
    WHERE cp.company_id = ${companyId}::uuid
    ORDER BY cp.updated_at DESC, cp.created_at DESC
  `;

  return rows.map((row) => ({
    ...row,
    manifest: normalizeJsonObject(row.manifest),
    config: normalizeJsonObject(row.config),
  }));
}

export async function getCompanyPlugin(sql: Sql, companyId: string, pluginId: string) {
  const rows = await sql<CompanyPluginRow[]>`
    SELECT
      p.id,
      cp.id AS installation_id,
      cp.company_id,
      p.slug,
      p.name,
      p.version,
      p.description,
      p.package_name,
      p.entrypoint,
      p.manifest,
      cp.status,
      cp.enabled,
      cp.config,
      cp.created_at,
      cp.updated_at
    FROM public.company_plugins cp
    INNER JOIN public.plugins p ON p.id = cp.plugin_id
    WHERE cp.company_id = ${companyId}::uuid
      AND p.id = ${pluginId}::uuid
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    manifest: normalizeJsonObject(row.manifest),
    config: normalizeJsonObject(row.config),
  };
}

export async function installCompanyPlugin(
  sql: Sql,
  input: {
    companyId: string;
    actorUserId: string;
    slug: string;
    name: string;
    version: string;
    description?: string | null;
    packageName?: string | null;
    entrypoint?: string | null;
    manifest?: JsonObject | null;
    config?: JsonObject | null;
    enabled?: boolean;
  },
) {
  if (!input.slug.trim() || !input.name.trim() || !input.version.trim()) {
    throw new HttpError(400, "slug, name, and version are required");
  }

  const pluginRows = await sql<{ id: string }[]>`
    INSERT INTO public.plugins (
      slug,
      name,
      version,
      description,
      package_name,
      entrypoint,
      manifest,
      created_by_user_id
    )
    VALUES (
      ${input.slug},
      ${input.name},
      ${input.version},
      ${input.description ?? null},
      ${input.packageName ?? null},
      ${input.entrypoint ?? null},
      ${JSON.stringify(input.manifest ?? {})}::jsonb,
      ${input.actorUserId}::uuid
    )
    ON CONFLICT (slug) DO UPDATE
      SET
        name = EXCLUDED.name,
        version = EXCLUDED.version,
        description = EXCLUDED.description,
        package_name = EXCLUDED.package_name,
        entrypoint = EXCLUDED.entrypoint,
        manifest = EXCLUDED.manifest,
        updated_at = now()
    RETURNING id
  `;

  const pluginId = pluginRows[0]?.id;
  if (!pluginId) {
    throw new HttpError(500, "Failed to register plugin");
  }

  await sql`
    INSERT INTO public.company_plugins (
      company_id,
      plugin_id,
      status,
      enabled,
      config,
      installed_by_user_id
    )
    VALUES (
      ${input.companyId}::uuid,
      ${pluginId}::uuid,
      ${input.enabled ? "enabled" : "installed"},
      ${input.enabled ?? false},
      ${JSON.stringify(input.config ?? {})}::jsonb,
      ${input.actorUserId}::uuid
    )
    ON CONFLICT (company_id, plugin_id) DO UPDATE
      SET
        status = EXCLUDED.status,
        enabled = EXCLUDED.enabled,
        config = EXCLUDED.config,
        installed_by_user_id = EXCLUDED.installed_by_user_id,
        updated_at = now()
  `;

  return await requireCompanyPlugin(sql, input.companyId, pluginId);
}

export async function updateCompanyPlugin(
  sql: Sql,
  input: {
    companyId: string;
    pluginId: string;
    enabled?: boolean;
    status?: string | null;
    config?: JsonObject | null;
  },
) {
  const updates: string[] = [];
  const values: ParameterOrJSON<never>[] = [];

  if (input.enabled !== undefined) {
    values.push(input.enabled);
    updates.push(`enabled = $${values.length}`);
  }

  if (input.status !== undefined) {
    values.push(input.status ?? "installed");
    updates.push(`status = $${values.length}`);
  } else if (input.enabled !== undefined) {
    values.push(input.enabled ? "enabled" : "disabled");
    updates.push(`status = $${values.length}`);
  }

  if (input.config !== undefined) {
    values.push(JSON.stringify(input.config ?? {}));
    updates.push(`config = $${values.length}::jsonb`);
  }

  if (updates.length === 0) {
    return await requireCompanyPlugin(sql, input.companyId, input.pluginId);
  }

  values.push(input.companyId, input.pluginId);
  const rows = await sql.unsafe<{ plugin_id: string }[]>(
    `UPDATE public.company_plugins
     SET ${updates.join(", ")}, updated_at = now()
     WHERE company_id = $${values.length - 1}::uuid
       AND plugin_id = $${values.length}::uuid
     RETURNING plugin_id`,
    values,
  );

  if (!rows[0]?.plugin_id) {
    throw new HttpError(404, "Plugin installation not found");
  }

  return await requireCompanyPlugin(sql, input.companyId, input.pluginId);
}

export async function uninstallCompanyPlugin(sql: Sql, companyId: string, pluginId: string) {
  const rows = await sql<{ plugin_id: string }[]>`
    UPDATE public.company_plugins
    SET status = 'uninstalled', enabled = false, updated_at = now()
    WHERE company_id = ${companyId}::uuid
      AND plugin_id = ${pluginId}::uuid
    RETURNING plugin_id
  `;

  if (!rows[0]?.plugin_id) {
    throw new HttpError(404, "Plugin installation not found");
  }

  return await requireCompanyPlugin(sql, companyId, pluginId);
}

export async function requireCompanyPlugin(sql: Sql, companyId: string, pluginId: string) {
  const plugin = await getCompanyPlugin(sql, companyId, pluginId);
  if (!plugin) {
    throw new HttpError(404, "Plugin not found");
  }
  return plugin;
}
