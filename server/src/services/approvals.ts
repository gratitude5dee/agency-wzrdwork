import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { approvalComments, approvals } from "@paperclipai/db";
import type { Sql } from "postgres";
import { asOptionalString, asString, HttpError } from "../http.js";
import { notFound, unprocessable } from "../errors.js";
import { redactCurrentUserText } from "../log-redaction.js";
import { agentService } from "./agents.js";
import { budgetService } from "./budgets.js";
import { notifyHireApproved } from "./hire-hook.js";

export type ApprovalDecision = "approved" | "rejected" | "revision_requested";

function redactApprovalComment<T extends { body: string }>(comment: T): T {
  return {
    ...comment,
    body: redactCurrentUserText(comment.body),
  };
}

export function approvalService(db: Db) {
  const agentsSvc = agentService(db);
  const budgets = budgetService(db);
  const canResolveStatuses = new Set(["pending", "revision_requested"]);
  const resolvableStatuses = Array.from(canResolveStatuses);
  type ApprovalRecord = typeof approvals.$inferSelect;
  type ResolutionResult = { approval: ApprovalRecord; applied: boolean };

  async function getExistingApproval(id: string) {
    const existing = await db
      .select()
      .from(approvals)
      .where(eq(approvals.id, id))
      .then((rows) => rows[0] ?? null);
    if (!existing) throw notFound("Approval not found");
    return existing;
  }

  async function resolveApproval(
    id: string,
    targetStatus: "approved" | "rejected",
    decidedByUserId: string,
    decisionNote: string | null | undefined,
  ): Promise<ResolutionResult> {
    const existing = await getExistingApproval(id);
    if (!canResolveStatuses.has(existing.status)) {
      if (existing.status === targetStatus) {
        return { approval: existing, applied: false };
      }
      throw unprocessable(
        `Only pending or revision requested approvals can be ${targetStatus === "approved" ? "approved" : "rejected"}`,
      );
    }

    const now = new Date();
    const updated = await db
      .update(approvals)
      .set({
        status: targetStatus,
        decidedByUserId,
        decisionNote: decisionNote ?? null,
        decidedAt: now,
        updatedAt: now,
      })
      .where(and(eq(approvals.id, id), inArray(approvals.status, resolvableStatuses)))
      .returning()
      .then((rows) => rows[0] ?? null);

    if (updated) {
      return { approval: updated, applied: true };
    }

    const latest = await getExistingApproval(id);
    if (latest.status === targetStatus) {
      return { approval: latest, applied: false };
    }

    throw unprocessable(
      `Only pending or revision requested approvals can be ${targetStatus === "approved" ? "approved" : "rejected"}`,
    );
  }

  return {
    list: (companyId: string, status?: string) => {
      const conditions = [eq(approvals.companyId, companyId)];
      if (status) conditions.push(eq(approvals.status, status));
      return db.select().from(approvals).where(and(...conditions));
    },

    getById: (id: string) =>
      db
        .select()
        .from(approvals)
        .where(eq(approvals.id, id))
        .then((rows) => rows[0] ?? null),

    create: (companyId: string, data: Omit<typeof approvals.$inferInsert, "companyId">) =>
      db
        .insert(approvals)
        .values({ ...data, companyId })
        .returning()
        .then((rows) => rows[0]),

    approve: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const { approval: updated, applied } = await resolveApproval(
        id,
        "approved",
        decidedByUserId,
        decisionNote,
      );

      let hireApprovedAgentId: string | null = null;
      const now = new Date();
      if (applied && updated.type === "hire_agent") {
        const payload = updated.payload as Record<string, unknown>;
        const payloadAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
        if (payloadAgentId) {
          await agentsSvc.activatePendingApproval(payloadAgentId);
          hireApprovedAgentId = payloadAgentId;
        } else {
          const created = await agentsSvc.create(updated.companyId, {
            name: String(payload.name ?? "New Agent"),
            role: String(payload.role ?? "general"),
            title: typeof payload.title === "string" ? payload.title : null,
            icon: typeof payload.icon === "string" ? payload.icon : null,
            reportsTo: typeof payload.reportsTo === "string" ? payload.reportsTo : null,
            capabilities: typeof payload.capabilities === "string" ? payload.capabilities : null,
            adapterType: String(payload.adapterType ?? "process"),
            adapterConfig:
              typeof payload.adapterConfig === "object" && payload.adapterConfig !== null
                ? (payload.adapterConfig as Record<string, unknown>)
                : {},
            runtimeConfig:
              typeof payload.runtimeConfig === "object" && payload.runtimeConfig !== null
                ? (payload.runtimeConfig as Record<string, unknown>)
                : {},
            budgetMonthlyCents:
              typeof payload.budgetMonthlyCents === "number" ? payload.budgetMonthlyCents : 0,
            metadata:
              typeof payload.metadata === "object" && payload.metadata !== null
                ? (payload.metadata as Record<string, unknown>)
                : null,
            status: "idle",
            spentMonthlyCents: 0,
            permissions: undefined,
            lastHeartbeatAt: null,
          });
          hireApprovedAgentId = created?.id ?? null;
        }
        if (hireApprovedAgentId) {
          const budgetMonthlyCents =
            typeof payload.budgetMonthlyCents === "number" ? payload.budgetMonthlyCents : 0;
          if (budgetMonthlyCents > 0) {
            await budgets.upsertPolicy(
              updated.companyId,
              {
                scopeType: "agent",
                scopeId: hireApprovedAgentId,
                amount: budgetMonthlyCents,
                windowKind: "calendar_month_utc",
              },
              decidedByUserId,
            );
          }
          void notifyHireApproved(db, {
            companyId: updated.companyId,
            agentId: hireApprovedAgentId,
            source: "approval",
            sourceId: id,
            approvedAt: now,
          }).catch(() => {});
        }
      }

      return { approval: updated, applied };
    },

    reject: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const { approval: updated, applied } = await resolveApproval(
        id,
        "rejected",
        decidedByUserId,
        decisionNote,
      );

      if (applied && updated.type === "hire_agent") {
        const payload = updated.payload as Record<string, unknown>;
        const payloadAgentId = typeof payload.agentId === "string" ? payload.agentId : null;
        if (payloadAgentId) {
          await agentsSvc.terminate(payloadAgentId);
        }
      }

      return { approval: updated, applied };
    },

    requestRevision: async (id: string, decidedByUserId: string, decisionNote?: string | null) => {
      const existing = await getExistingApproval(id);
      if (existing.status !== "pending") {
        throw unprocessable("Only pending approvals can request revision");
      }

      const now = new Date();
      return db
        .update(approvals)
        .set({
          status: "revision_requested",
          decidedByUserId,
          decisionNote: decisionNote ?? null,
          decidedAt: now,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);
    },

    resubmit: async (id: string, payload?: Record<string, unknown>) => {
      const existing = await getExistingApproval(id);
      if (existing.status !== "revision_requested") {
        throw unprocessable("Only revision requested approvals can be resubmitted");
      }

      const now = new Date();
      return db
        .update(approvals)
        .set({
          status: "pending",
          payload: payload ?? existing.payload,
          decisionNote: null,
          decidedByUserId: null,
          decidedAt: null,
          updatedAt: now,
        })
        .where(eq(approvals.id, id))
        .returning()
        .then((rows) => rows[0]);
    },

    listComments: async (approvalId: string) => {
      const existing = await getExistingApproval(approvalId);
      return db
        .select()
        .from(approvalComments)
        .where(
          and(
            eq(approvalComments.approvalId, approvalId),
            eq(approvalComments.companyId, existing.companyId),
          ),
        )
        .orderBy(asc(approvalComments.createdAt))
        .then((comments) => comments.map(redactApprovalComment));
    },

    addComment: async (
      approvalId: string,
      body: string,
      actor: { agentId?: string; userId?: string },
    ) => {
      const existing = await getExistingApproval(approvalId);
      const redactedBody = redactCurrentUserText(body);
      return db
        .insert(approvalComments)
        .values({
          companyId: existing.companyId,
          approvalId,
          authorAgentId: actor.agentId ?? null,
          authorUserId: actor.userId ?? null,
          body: redactedBody,
        })
        .returning()
        .then((rows) => redactApprovalComment(rows[0]));
    },
  };
}

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
