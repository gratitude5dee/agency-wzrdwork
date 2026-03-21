import { json, readJson, HttpError } from "../http.js";
import { requireCompanyAccess } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import { createApproval, decideApproval, getApproval, listApprovals, type ApprovalDecision } from "../services/approvals.js";
import type { RouteContext, RouteResult } from "../types.js";

function matchApprovalPath(pathname: string): { approvalId: string | null; action: "detail" | "decision" | null } {
  const decisionMatch = pathname.match(/^\/api\/approvals\/([^/]+)\/decision$/);
  if (decisionMatch) {
    return { approvalId: decisionMatch[1], action: "decision" };
  }

  const detailMatch = pathname.match(/^\/api\/approvals\/([^/]+)$/);
  if (detailMatch) {
    return { approvalId: detailMatch[1], action: "detail" };
  }

  return { approvalId: null, action: null };
}

export async function handleApprovalsRoute(context: RouteContext): Promise<RouteResult> {
  if (context.url.pathname === "/api/approvals" && context.request.method === "GET") {
    const companyId = context.url.searchParams.get("companyId");
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const approvals = await listApprovals(context.sql, {
      companyId,
      status: context.url.searchParams.get("status"),
      limit: context.url.searchParams.get("limit")
        ? Number(context.url.searchParams.get("limit"))
        : null,
    });

    json(context.response, 200, { approvals });
    return { handled: true };
  }

  if (context.url.pathname === "/api/approvals" && context.request.method === "POST") {
    const body = await readJson(context.request);
    const companyId = typeof body.companyId === "string" ? body.companyId : null;
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const approval = await createApproval(context.sql, {
      companyId,
      issueId: typeof body.issueId === "string" ? body.issueId : null,
      requestedByAgentId: typeof body.requestedByAgentId === "string" ? body.requestedByAgentId : null,
      summary: typeof body.summary === "string" ? body.summary : "",
      details: typeof body.details === "string" ? body.details : null,
    });

    context.liveEvents.publish({
      type: "approval.created",
      companyId,
      payload: {
        approvalId: approval.id,
        actorUserId: actor.user.id,
        requestedByAgentId: approval.requested_by_agent_id,
      },
    });
    context.liveEvents.publish({
      type: "activity.created",
      companyId,
      payload: { action: "approval.created", approvalId: approval.id },
    });
    context.liveEvents.publish({
      type: "dashboard.updated",
      companyId,
      payload: { reason: "approval.created" },
    });
    if (approval.requested_by_agent_id) {
      context.liveEvents.publish({
        type: "agent.updated",
        companyId,
        payload: { agentId: approval.requested_by_agent_id },
      });
    }

    json(context.response, 201, { approval });
    return { handled: true };
  }

  const { approvalId, action } = matchApprovalPath(context.url.pathname);
  if (!approvalId || !action) {
    return { handled: false };
  }

  const approval = await getApproval(context.sql, approvalId);
  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, approval.company_id);

  if (context.request.method === "GET" && action === "detail") {
    json(context.response, 200, { approval });
    return { handled: true };
  }

  if (context.request.method === "POST" && action === "decision") {
    const body = await readJson(context.request);
    const decision = typeof body.decision === "string" ? (body.decision as ApprovalDecision) : null;
    if (!decision || !["approved", "rejected", "revision_requested"].includes(decision)) {
      throw new HttpError(400, "decision must be approved, rejected, or revision_requested");
    }

    const updated = await decideApproval(context.sql, approvalId, {
      decision,
      note: typeof body.note === "string" ? body.note : null,
    });

    context.liveEvents.publish({
      type: "approval.updated",
      companyId: updated.company_id,
      payload: {
        approvalId: updated.id,
        decision,
        actorUserId: actor.user.id,
      },
    });
    context.liveEvents.publish({
      type: "activity.created",
      companyId: updated.company_id,
      payload: { action: "approval.updated", approvalId: updated.id },
    });
    context.liveEvents.publish({
      type: "dashboard.updated",
      companyId: updated.company_id,
      payload: { reason: "approval.updated" },
    });
    if (updated.requested_by_agent_id) {
      context.liveEvents.publish({
        type: "agent.updated",
        companyId: updated.company_id,
        payload: { agentId: updated.requested_by_agent_id },
      });
    }

    json(context.response, 200, { approval: updated });
    return { handled: true };
  }

  return { handled: false };
}
