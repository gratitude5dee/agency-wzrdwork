import { json, HttpError } from "../http.js";
import { requireCompanyAccess } from "../services/access.js";
import { authenticateRequest, resolveAccessPayload } from "../services/auth.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleAccessRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method !== "GET" || context.url.pathname !== "/api/access/me") {
    return { handled: false };
  }

  const companyId = context.url.searchParams.get("companyId");
  const { actor } = await authenticateRequest(context.sql, context.config, context.request);

  if (companyId) {
    requireCompanyAccess(actor, companyId);
  }

  const access = await resolveAccessPayload(context.sql, actor, companyId);

  json(context.response, 200, {
    actor,
    activeCompany: access.activeCompany,
    accessibleCompanies: access.accessibleCompanies,
    memberships: actor.memberships,
    instanceRoles: actor.instanceRoles,
  });
  return { handled: true };
}
