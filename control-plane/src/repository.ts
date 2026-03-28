import postgres, { type Sql } from "postgres";
import type {
  AgentRow,
  ClaimedWakeupContext,
  JsonObject,
  RuntimeStateData,
  ScheduledAgentRow,
  WakeupRequestRow,
} from "./types.js";
import { asObject, parseRuntimeState } from "./utils.js";

export interface DbExecutor {
  <TRow extends readonly unknown[] = Record<string, unknown>[]>(
    template: TemplateStringsArray,
    ...parameters: unknown[]
  ): Promise<TRow>;
  json(value: unknown): unknown;
}

interface ClaimResultRow extends WakeupRequestRow {
  payload: JsonObject;
}

interface ScheduledAgentSqlRow extends AgentRow {
  adapter_config: JsonObject | null;
  state_data: RuntimeStateData | null;
}

interface ClaimedWakeupSqlRow extends WakeupRequestRow {
  payload: JsonObject;
  adapter_type: string;
  adapter_config: JsonObject | null;
  agent_name: string;
  agent_role: string | null;
  agent_status: string;
  state_data: RuntimeStateData | null;
}

export function createDatabase(
  databaseUrl: string,
  options: { prepare: boolean },
): Sql {
  return postgres(databaseUrl, {
    max: 5,
    prepare: options.prepare,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

export async function listScheduledAgents(sql: DbExecutor): Promise<ScheduledAgentRow[]> {
  const rows = await sql<ScheduledAgentSqlRow[]>`
    SELECT
      a.id,
      a.company_id,
      a.name,
      a.role,
      a.status,
      a.adapter_type,
      a.adapter_config,
      ars.state_data
    FROM public.agents a
    LEFT JOIN public.agent_runtime_state ars
      ON ars.agent_id = a.id
    WHERE COALESCE((a.adapter_config->>'heartbeatEnabled')::boolean, false) = true
      AND COALESCE((a.adapter_config->>'intervalSec')::integer, 0) > 0
      AND a.status NOT IN ('paused', 'terminated')
  `;

  return rows.map((row) => ({
    ...row,
    adapter_config: row.adapter_config ? asObject(row.adapter_config) : {},
    state_data: row.state_data ? parseRuntimeState(row.state_data) : null,
  }));
}

export async function enqueueWakeup(
  sql: DbExecutor,
  input: {
    agentId: string;
    companyId: string;
    reason: string;
    triggerType: "manual" | "timer";
    payload: JsonObject;
  },
): Promise<{ wakeupRequestId: string; heartbeatRunId: string | null }> {
  const rows = await sql<{ wakeup_request_id: string; heartbeat_run_id: string | null }[]>`
    SELECT *
    FROM public.enqueue_agent_wakeup(
      ${input.agentId}::uuid,
      ${input.companyId}::uuid,
      ${input.reason},
      ${input.triggerType},
      ${sql.json(input.payload)}
    )
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("enqueue_agent_wakeup returned no rows");
  }
  return {
    wakeupRequestId: row.wakeup_request_id,
    heartbeatRunId: row.heartbeat_run_id,
  };
}

export async function claimNextWakeup(
  sql: DbExecutor,
  workerId: string,
  staleClaimMs: number,
): Promise<WakeupRequestRow | null> {
  const rows = await sql<ClaimResultRow[]>`
    WITH candidate AS (
      SELECT id
      FROM public.agent_wakeup_requests
      WHERE status = 'pending'
         OR (
           status = 'claimed'
           AND claimed_at IS NOT NULL
           AND claimed_at < now() - (${staleClaimMs} * interval '1 millisecond')
         )
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE public.agent_wakeup_requests req
       SET status = 'claimed',
           claimed_at = now(),
           claimed_by = ${workerId},
           attempt_count = COALESCE(req.attempt_count, 0) + 1,
           last_error = NULL
      FROM candidate
     WHERE req.id = candidate.id
    RETURNING req.*
  `;

  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    payload: asObject(row.payload),
  };
}

export async function loadClaimedWakeupContext(
  sql: DbExecutor,
  wakeupId: string,
): Promise<ClaimedWakeupContext | null> {
  const rows = await sql<ClaimedWakeupSqlRow[]>`
    SELECT
      req.*,
      a.adapter_type,
      a.adapter_config,
      a.name AS agent_name,
      a.role AS agent_role,
      a.status AS agent_status,
      ars.state_data
    FROM public.agent_wakeup_requests req
    JOIN public.agents a
      ON a.id = req.agent_id
    LEFT JOIN public.agent_runtime_state ars
      ON ars.agent_id = a.id
    WHERE req.id = ${wakeupId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    wakeup: {
      ...row,
      payload: asObject(row.payload),
    },
    agent: {
      id: row.agent_id,
      company_id: row.company_id,
      name: row.agent_name,
      role: row.agent_role,
      status: row.agent_status,
      adapter_type: row.adapter_type,
      adapter_config: row.adapter_config ? asObject(row.adapter_config) : {},
    },
    runtimeState: parseRuntimeState(row.state_data),
  };
}

export async function loadRuntimeState(
  sql: DbExecutor,
  agentId: string,
): Promise<RuntimeStateData> {
  const rows = await sql<{ state_data: RuntimeStateData | null }[]>`
    SELECT state_data
    FROM public.agent_runtime_state
    WHERE agent_id = ${agentId}
    LIMIT 1
  `;

  return parseRuntimeState(rows[0]?.state_data);
}

export async function upsertRuntimeState(
  sql: DbExecutor,
  agentId: string,
  companyId: string,
  state: RuntimeStateData,
): Promise<void> {
  await sql`
    INSERT INTO public.agent_runtime_state (agent_id, company_id, state_data)
    VALUES (${agentId}::uuid, ${companyId}::uuid, ${sql.json(state)})
    ON CONFLICT (agent_id) DO UPDATE
      SET company_id = EXCLUDED.company_id,
          state_data = EXCLUDED.state_data,
          updated_at = now()
  `;
}

export async function closeDatabase(sql: Sql): Promise<void> {
  await sql.end({ timeout: 5 });
}
