import { json, HttpError } from "../http.js";
import { requireCompanyAccess } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import { listActivity } from "../services/core.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleActivityRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method !== "GET" || context.url.pathname !== "/api/activity") {
    return { handled: false };
  }

  const companyId = context.url.searchParams.get("companyId");
  if (!companyId) {
    throw new HttpError(400, "companyId is required");
  }

  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, companyId);

  const activity = await listActivity(context.sql, {
    companyId,
    limit: context.url.searchParams.get("limit")
      ? Number(context.url.searchParams.get("limit"))
      : null,
  });

  json(context.response, 200, { activity });
  return { handled: true };
}
