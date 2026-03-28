import { json, HttpError } from "../http.js";
import { requireCompanyAccess } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import { getAgencySnapshot } from "../services/core.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleAgencyRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method !== "GET" || context.url.pathname !== "/api/agency/snapshot") {
    return { handled: false };
  }

  const companyId = context.url.searchParams.get("companyId");
  if (!companyId) {
    throw new HttpError(400, "companyId is required");
  }

  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, companyId);

  const snapshot = await getAgencySnapshot(context.sql, companyId);
  json(context.response, 200, snapshot);
  return { handled: true };
}
