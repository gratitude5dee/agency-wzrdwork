import { json, readJson, HttpError } from "../http.js";
import { createIssue, loadIssueCompany, updateIssueStatus } from "../services/issues.js";
import { requireCompanyAccess } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleIssuesRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method === "POST" && context.url.pathname === "/api/issues") {
    const body = await readJson(context.request);
    const companyId = typeof body.companyId === "string" ? body.companyId : null;
    if (!companyId) throw new HttpError(400, "companyId is required");
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const created = await createIssue(context.sql, {
      companyId,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      assigneeAgentId: typeof body.assigneeAgentId === "string" ? body.assigneeAgentId : null,
      title: String(body.title ?? ""),
      description: typeof body.description === "string" ? body.description : null,
      priority: String(body.priority ?? ""),
    });

    context.liveEvents.publish({
      type: "issue.created",
      companyId,
      payload: { issueId: created.id, identifier: created.identifier, actorUserId: actor.user.id },
    });

    json(context.response, 201, created);
    return { handled: true };
  }

  const statusMatch = context.url.pathname.match(/^\/api\/issues\/([^/]+)\/status$/);
  if (context.request.method === "PATCH" && statusMatch) {
    const issueId = statusMatch[1];
    const issue = await loadIssueCompany(context.sql, issueId);
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, issue.companyId);

    const body = await readJson(context.request);
    await updateIssueStatus(context.sql, issueId, String(body.status ?? ""));

    context.liveEvents.publish({
      type: "issue.updated",
      companyId: issue.companyId,
      payload: { issueId, status: String(body.status ?? ""), actorUserId: actor.user.id },
    });

    json(context.response, 200, { ok: true });
    return { handled: true };
  }

  return { handled: false };
}
