import type { Sql } from "postgres";

interface RecordActivityInput {
  companyId: string;
  agentId?: string | null;
  issueId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
}

export async function recordActivity(sql: Sql, input: RecordActivityInput): Promise<void> {
  await sql`
    INSERT INTO public.activity_events (
      company_id,
      agent_id,
      issue_id,
      action,
      details
    )
    VALUES (
      ${input.companyId}::uuid,
      ${input.agentId ?? null}::uuid,
      ${input.issueId ?? null}::uuid,
      ${input.action},
      ${input.details ? JSON.stringify(input.details) : null}
    )
  `;
}
