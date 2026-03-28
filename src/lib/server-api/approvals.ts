import { requestServerJson, type ServerActorContext } from "./http";

export type ApprovalDecision = "approved" | "rejected" | "revision_requested";

export interface ApprovalRecord {
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

export async function listApprovalRecords(
  input: ServerActorContext & { companyId: string; status?: string | null; limit?: number | null },
): Promise<ApprovalRecord[]> {
  const params = new URLSearchParams({ companyId: input.companyId });
  if (input.status) params.set("status", input.status);
  if (input.limit) params.set("limit", String(input.limit));
  const data = await requestServerJson<{ approvals: ApprovalRecord[] }>(`/api/approvals?${params.toString()}`, {
    method: "GET",
    actor: input,
  });
  return data.approvals ?? [];
}

export async function getApprovalRecord(
  input: ServerActorContext & { approvalId: string; companyId?: string | null },
): Promise<ApprovalRecord> {
  const data = await requestServerJson<{ approval: ApprovalRecord }>(`/api/approvals/${input.approvalId}`, {
    method: "GET",
    actor: input,
  });
  return data.approval;
}

export async function createApprovalRecord(
  input: ServerActorContext & {
    companyId: string;
    issueId?: string | null;
    requestedByAgentId?: string | null;
    summary: string;
    details?: string | null;
  },
): Promise<ApprovalRecord> {
  const data = await requestServerJson<{ approval: ApprovalRecord }>("/api/approvals", {
    method: "POST",
    actor: input,
    body: {
      companyId: input.companyId,
      issueId: input.issueId ?? null,
      requestedByAgentId: input.requestedByAgentId ?? null,
      summary: input.summary,
      details: input.details ?? null,
    },
  });
  return data.approval;
}

export async function decideApprovalRecord(
  input: ServerActorContext & {
    approvalId: string;
    decision: ApprovalDecision;
    note?: string | null;
  },
): Promise<ApprovalRecord> {
  const data = await requestServerJson<{ approval: ApprovalRecord }>(
    `/api/approvals/${input.approvalId}/decision`,
    {
      method: "POST",
      actor: input,
      body: {
        decision: input.decision,
        note: input.note ?? null,
      },
    },
  );
  return data.approval;
}
