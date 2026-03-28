import type { Sql } from "postgres";
import { asOptionalString, asString, asStringArray, HttpError } from "../http.js";
import type { JsonObject } from "../types.js";

export interface CreateAgentInput {
  companyId: string;
  name: string;
  title?: string | null;
  role: string;
  reportsTo?: string | null;
  adapterType: string;
  adapterConfig: JsonObject;
  selectedSkillIds?: string[];
  integrationIds?: string[];
}

function isMissingRelation(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  return code === "42P01";
}

export async function createAgent(sql: Sql, input: CreateAgentInput): Promise<{ id: string }> {
  const companyId = asString(input.companyId);
  const name = asString(input.name);
  const role = asString(input.role);
  const adapterType = asString(input.adapterType);

  if (!companyId || !name || !role || !adapterType) {
    throw new HttpError(400, "companyId, name, role, and adapterType are required");
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO public.agents (
      company_id,
      name,
      title,
      role,
      reports_to,
      adapter_type,
      adapter_config,
      status
    )
    VALUES (
      ${companyId}::uuid,
      ${name},
      ${asOptionalString(input.title)},
      ${role},
      ${asOptionalString(input.reportsTo)}::uuid,
      ${adapterType},
      ${sql.json(input.adapterConfig ?? {})},
      'idle'
    )
    RETURNING id
  `;

  const created = rows[0];
  if (!created) {
    throw new HttpError(500, "Failed to create agent");
  }

  for (const skillId of asStringArray(input.selectedSkillIds)) {
    await sql`
      INSERT INTO public.agent_skills (agent_id, skill_id, company_id)
      VALUES (${created.id}::uuid, ${skillId}::uuid, ${companyId}::uuid)
      ON CONFLICT DO NOTHING
    `;
  }

  for (const integrationKey of asStringArray(input.integrationIds)) {
    try {
      await sql`
        INSERT INTO public.agent_integrations (agent_id, integration_key, company_id, enabled)
        VALUES (${created.id}::uuid, ${integrationKey}, ${companyId}::uuid, true)
        ON CONFLICT DO NOTHING
      `;
    } catch (error) {
      if (!isMissingRelation(error)) throw error;
    }
  }

  return created;
}

export async function listAgents(sql: Sql, companyId: string): Promise<Array<{
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
  reports_to: string | null;
  company_id: string;
  created_at: string;
}>> {
  const rows = await sql<Array<{
    id: string;
    name: string;
    role: string;
    title: string | null;
    status: string;
    adapter_type: string;
    reports_to: string | null;
    company_id: string;
    created_at: string;
  }>>`
    SELECT id, name, role, title, status, adapter_type, reports_to, company_id, created_at
    FROM public.agents
    WHERE company_id = ${companyId}::uuid
    ORDER BY created_at DESC
  `;

  return rows;
}

export async function loadAgentCompanyId(sql: Sql, agentId: string): Promise<string> {
  const rows = await sql<{ company_id: string }[]>`
    SELECT company_id
    FROM public.agents
    WHERE id = ${agentId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) throw new HttpError(404, "Agent not found");
  return row.company_id;
}

export async function getAgentDetail(sql: Sql, agentId: string): Promise<{
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
}> {
  const agentRows = await sql<Array<{
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
  }>>`
    SELECT
      company_id,
      id,
      name,
      role,
      title,
      status,
      adapter_type,
      adapter_config,
      capabilities,
      reports_to,
      seat_index,
      private_cognition_enabled,
      venice_model,
      created_at,
      updated_at
    FROM public.agents
    WHERE id = ${agentId}::uuid
    LIMIT 1
  `;

  const agent = agentRows[0];
  if (!agent) {
    throw new HttpError(404, "Agent not found");
  }

  const [issues, runs] = await Promise.all([
    sql<Array<{
      id: string;
      identifier: string | null;
      title: string;
      status: string;
      priority: string;
    }>>`
      SELECT id, identifier, title, status, priority
      FROM public.issues
      WHERE assignee_agent_id = ${agentId}::uuid
      ORDER BY created_at DESC
    `,
    sql<Array<{
      id: string;
      status: string;
      summary: string | null;
      created_at: string;
      total_cost_usd: number | null;
    }>>`
      SELECT id, status, summary, created_at, total_cost_usd
      FROM public.runs
      WHERE agent_id = ${agentId}::uuid
      ORDER BY created_at DESC
      LIMIT 50
    `,
  ]);

  return { agent, issues, runs };
}

export async function updateAgentSettings(
  sql: Sql,
  agentId: string,
  patch: {
    privateCognitionEnabled?: boolean;
    veniceModel?: string | null;
  },
): Promise<void> {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (typeof patch.privateCognitionEnabled === "boolean") {
    values.push(patch.privateCognitionEnabled);
    updates.push(`private_cognition_enabled = $${values.length}`);
  }

  if ("veniceModel" in patch) {
    values.push(asOptionalString(patch.veniceModel));
    updates.push(`venice_model = $${values.length}`);
  }

  if (updates.length === 0) {
    throw new HttpError(400, "No supported agent fields were provided");
  }

  values.push(agentId);
  await (sql as unknown as { unsafe: (query: string, values: unknown[]) => Promise<unknown> }).unsafe(
    `UPDATE public.agents SET ${updates.join(", ")}, updated_at = now() WHERE id = $${values.length}::uuid`,
    values,
  );
}

export async function enqueueAgentWakeup(
  sql: Sql,
  input: {
    agentId: string;
    companyId: string;
    reason: string;
    payload: JsonObject;
  },
): Promise<{ wakeupRequestId: string | null; heartbeatRunId: string | null; status: string }> {
  const rows = await sql<{ wakeup_request_id: string | null; heartbeat_run_id: string | null }[]>`
    SELECT *
    FROM public.enqueue_agent_wakeup(
      ${input.agentId}::uuid,
      ${input.companyId}::uuid,
      ${input.reason},
      'manual',
      ${sql.json(input.payload ?? {})}
    )
  `;

  return {
    wakeupRequestId: rows[0]?.wakeup_request_id ?? null,
    heartbeatRunId: rows[0]?.heartbeat_run_id ?? null,
    status: "queued",
  };
}
