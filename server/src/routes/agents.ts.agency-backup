import { json, readJson, HttpError } from "../http.js";
import { createAgent, enqueueAgentWakeup, getAgentDetail, listAgents, loadAgentCompanyId, updateAgentSettings } from "../services/agents.js";
import { requireCompanyAccess } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import type { JsonObject, RouteContext, RouteResult } from "../types.js";

function matchAgentPath(pathname: string): { agentId: string; action: "patch" | "wakeup" | null } {
  const wakeupMatch = pathname.match(/^\/api\/agents\/([^/]+)\/wakeup$/);
  if (wakeupMatch) {
    return { agentId: wakeupMatch[1], action: "wakeup" };
  }

  const patchMatch = pathname.match(/^\/api\/agents\/([^/]+)$/);
  if (patchMatch) {
    return { agentId: patchMatch[1], action: "patch" };
  }

  return { agentId: "", action: null };
}

export async function handleAgentsRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method === "GET" && context.url.pathname === "/api/agents") {
    const companyId = context.url.searchParams.get("companyId");
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const agents = await listAgents(context.sql, companyId);
    json(context.response, 200, { agents });
    return { handled: true };
  }

  if (context.request.method === "POST" && context.url.pathname === "/api/agents") {
    const body = await readJson(context.request);
    const companyId = typeof body.companyId === "string" ? body.companyId : null;
    if (!companyId) throw new HttpError(400, "companyId is required");
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const created = await createAgent(context.sql, {
      companyId,
      name: String(body.name ?? ""),
      title: typeof body.title === "string" ? body.title : null,
      role: String(body.role ?? ""),
      reportsTo: typeof body.reportsTo === "string" ? body.reportsTo : null,
      adapterType: String(body.adapterType ?? ""),
      adapterConfig: ((body.adapterConfig ?? {}) as JsonObject),
      selectedSkillIds: Array.isArray(body.selectedSkillIds) ? body.selectedSkillIds.map(String) : [],
      integrationIds: Array.isArray(body.integrationIds) ? body.integrationIds.map(String) : [],
    });

    context.liveEvents.publish({
      type: "agent.created",
      companyId,
      payload: { agentId: created.id, actorUserId: actor.user.id },
    });

    json(context.response, 201, created);
    return { handled: true };
  }

  const detailMatch = context.url.pathname.match(/^\/api\/agents\/([^/]+)$/);
  if (context.request.method === "GET" && detailMatch) {
    const agentId = detailMatch[1];
    const companyId = await loadAgentCompanyId(context.sql, agentId);
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const detail = await getAgentDetail(context.sql, agentId);
    json(context.response, 200, detail);
    return { handled: true };
  }

  const { agentId, action } = matchAgentPath(context.url.pathname);
  if (!action) return { handled: false };

  const companyId = await loadAgentCompanyId(context.sql, agentId);
  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, companyId);

  if (context.request.method === "PATCH" && action === "patch") {
    const body = await readJson(context.request);
    await updateAgentSettings(context.sql, agentId, {
      privateCognitionEnabled:
        typeof body.privateCognitionEnabled === "boolean"
          ? body.privateCognitionEnabled
          : undefined,
      veniceModel:
        body.veniceModel === null || typeof body.veniceModel === "string"
          ? (body.veniceModel as string | null)
          : undefined,
    });

    context.liveEvents.publish({
      type: "agent.updated",
      companyId,
      payload: { agentId, actorUserId: actor.user.id },
    });

    json(context.response, 200, { ok: true });
    return { handled: true };
  }

  if (context.request.method === "POST" && action === "wakeup") {
    const body = await readJson(context.request);
    const result = await enqueueAgentWakeup(context.sql, {
      agentId,
      companyId,
      reason:
        typeof body.reason === "string" && body.reason.trim() !== ""
          ? body.reason
          : `Manual wakeup for ${agentId}`,
      payload: (body.payload ?? {}) as JsonObject,
    });

    context.liveEvents.publish({
      type: "agent.wakeup_enqueued",
      companyId,
      payload: {
        agentId,
        actorUserId: actor.user.id,
        wakeupRequestId: result.wakeupRequestId,
        heartbeatRunId: result.heartbeatRunId,
      },
    });

    json(context.response, 200, result);
    return { handled: true };
  }

  return { handled: false };
}
