import { HttpError, asOptionalString, asString, json, readJson } from "../http.js";
import { authenticateRequest } from "../services/auth.js";
import { requireCompanyAccess } from "../services/access.js";
import { recordActivity } from "../services/activity-log.js";
import { createGoal, deleteGoal, getGoal, listGoals, requireGoal, updateGoal } from "../services/goals.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleGoalsRoute(context: RouteContext): Promise<RouteResult> {
  const companyMatch = context.url.pathname.match(/^\/api\/companies\/([^/]+)\/goals$/);
  if (companyMatch) {
    const companyId = companyMatch[1];
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    if (context.request.method === "GET") {
      json(context.response, 200, await listGoals(context.sql, companyId));
      return { handled: true };
    }

    if (context.request.method === "POST") {
      const body = await readJson(context.request);
      const title = asString(body.title);
      if (!title) throw new HttpError(400, "title is required");

      const goal = await createGoal(context.sql, {
        companyId,
        title,
        summary: asOptionalString(body.summary),
        status: asOptionalString(body.status),
        ownerAgentId: asOptionalString(body.ownerAgentId),
      });

      await recordActivity(context.sql, {
        companyId,
        action: "goal.created",
        details: { goalId: goal.id, title: goal.title },
      });
      context.liveEvents.publish({
        type: "goal.created",
        companyId,
        payload: { goalId: goal.id },
      });

      json(context.response, 201, goal);
      return { handled: true };
    }
  }

  const goalMatch = context.url.pathname.match(/^\/api\/goals\/([^/]+)$/);
  if (!goalMatch) {
    return { handled: false };
  }

  const goal = await requireGoal(context.sql, goalMatch[1]);
  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, goal.company_id);

  if (context.request.method === "GET") {
    json(context.response, 200, goal);
    return { handled: true };
  }

  if (context.request.method === "PATCH") {
    const body = await readJson(context.request);
    const updated = await updateGoal(context.sql, goal.id, {
      title: body.title === undefined ? undefined : asString(body.title) ?? undefined,
      summary: body.summary === undefined ? undefined : asOptionalString(body.summary),
      status: body.status === undefined ? undefined : asOptionalString(body.status),
      ownerAgentId:
        body.ownerAgentId === undefined ? undefined : asOptionalString(body.ownerAgentId),
    });

    await recordActivity(context.sql, {
      companyId: goal.company_id,
      action: "goal.updated",
      details: { goalId: goal.id, changedKeys: Object.keys(body).sort() },
    });
    context.liveEvents.publish({
      type: "goal.updated",
      companyId: goal.company_id,
      payload: { goalId: goal.id },
    });

    json(context.response, 200, updated);
    return { handled: true };
  }

  if (context.request.method === "DELETE") {
    const removed = await deleteGoal(context.sql, goal.id);
    await recordActivity(context.sql, {
      companyId: goal.company_id,
      action: "goal.deleted",
      details: { goalId: goal.id },
    });
    context.liveEvents.publish({
      type: "goal.deleted",
      companyId: goal.company_id,
      payload: { goalId: goal.id },
    });
    json(context.response, 200, removed);
    return { handled: true };
  }

  return { handled: false };
}
