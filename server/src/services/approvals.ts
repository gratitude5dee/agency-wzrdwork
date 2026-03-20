import type { Sql } from "postgres";
import { asOptionalString, asString, HttpError } from "../http.js";

export type ApprovalDecision = "approved" | "rejected" | "revision_requested";

interface ApprovalRow {
  id: string;
  company_id: string;
  issue_id: string | null;
  requested_by_agent_id: string | null;
  status: string;
  summary: string;
  details: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

async function loadApproval(sql: Sql, approvalId: string): Promise<ApprovalRow> {
  const rows = await sql<ApprovalRow[]>`
    SELECT
      id,
      company_id,
      issue_id,
      requested_by_agent_id,
      status,
      summary,
      details,
      resolution_note,
      created_at,
      resolved_at
    FROM public.approvals
    WHERE id = ${approvalId}::uuid
    LIMIT 1
  `;

  const approval = rows[0];
  if (!approval) {
    throw new HttpError(404, "Approval not found");
  }
  return approval;
}

export async function listApprovals(
  sql: Sql,
  input: { companyId: string; status?: string | null; limit?: number | null },
): Promise<ApprovalRow[]> {
  const companyId = asString(input.companyId);
  if (!companyId) {
    throw new HttpError(400, "companyId is required");
  }

  const limit = Math.min(Math.max(Number(input.limit ?? 50), 1), 200);
  const status = asOptionalString(input.status);

  if (status) {
    return await sql<ApprovalRow[]>`
      SELECT
        id,
        company_id,
        issue_id,
        requested_by_agent_id,
        status,
        summary,
        details,
        resolution_note,
        created_at,
        resolved_at
      FROM public.approvals
      WHERE company_id = ${companyId}::uuid
        AND status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
  }

  return await sql<ApprovalRow[]>`
    SELECT
      id,
      company_id,
      issue_id,
      requested_by_agent_id,
      status,
      summary,
      details,
      resolution_note,
      created_at,
      resolved_at
    FROM public.approvals
    WHERE company_id = ${companyId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getApproval(sql: Sql, approvalId: string): Promise<ApprovalRow> {
  return await loadApproval(sql, approvalId);
}

export async function createApproval(
  sql: Sql,
  input: {
    companyId: string;
    issueId?: string | null;
    requestedByAgentId?: string | null;
    summary: string;
    details?: string | null;
  },
): Promise<ApprovalRow> {
  const companyId = asString(input.companyId);
  const summary = asString(input.summary);
  if (!companyId || !summary) {
    throw new HttpError(400, "companyId and summary are required");
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO public.approvals (
      company_id,
      issue_id,
      requested_by_agent_id,
      status,
      summary,
      details
    )
    VALUES (
      ${companyId}::uuid,
      ${asOptionalString(input.issueId)}::uuid,
      ${asOptionalString(input.requestedByAgentId)}::uuid,
      'pending',
      ${summary},
      ${asOptionalString(input.details)}
    )
    RETURNING id
  `;

  const approvalId = rows[0]?.id;
  if (!approvalId) {
    throw new HttpError(500, "Failed to create approval");
  }

  if (input.requestedByAgentId) {
    await sql`
      UPDATE public.agents
      SET status = 'pending_approval',
          updated_at = now()
      WHERE id = ${input.requestedByAgentId}::uuid
    `;
  }

  await sql`
    INSERT INTO public.activity_events (company_id, agent_id, issue_id, action, details)
    VALUES (
      ${companyId}::uuid,
      ${asOptionalString(input.requestedByAgentId)}::uuid,
      ${asOptionalString(input.issueId)}::uuid,
      'approval.created',
      ${summary}
    )
  `;

  return await loadApproval(sql, approvalId);
}

export async function decideApproval(
  sql: Sql,
  approvalId: string,
  input: { decision: ApprovalDecision; note?: string | null },
): Promise<ApprovalRow> {
  const approval = await loadApproval(sql, approvalId);
  if (approval.status !== "pending") {
    throw new HttpError(409, "Approval is no longer pending");
  }

  await sql`
    UPDATE public.approvals
    SET status = ${input.decision},
        resolution_note = ${asOptionalString(input.note)},
        resolved_at = now()
    WHERE id = ${approvalId}::uuid
  `;

  if (approval.requested_by_agent_id) {
    const pendingRows = await sql<{ total: number }[]>`
      SELECT COUNT(*)::integer AS total
      FROM public.approvals
      WHERE requested_by_agent_id = ${approval.requested_by_agent_id}::uuid
        AND status = 'pending'
    `;

    if (Number(pendingRows[0]?.total ?? 0) === 0) {
      await sql`
        UPDATE public.agents
        SET status = 'idle',
            updated_at = now()
        WHERE id = ${approval.requested_by_agent_id}::uuid
      `;
    }
  }

  const details = input.note?.trim()
    ? `${approval.summary} (${input.decision}): ${input.note.trim()}`
    : `${approval.summary} (${input.decision})`;

  await sql`
    INSERT INTO public.activity_events (company_id, agent_id, issue_id, action, details)
    VALUES (
      ${approval.company_id}::uuid,
      ${asOptionalString(approval.requested_by_agent_id)}::uuid,
      ${asOptionalString(approval.issue_id)}::uuid,
      'approval.updated',
      ${details}
    )
  `;

  return await loadApproval(sql, approvalId);
}
