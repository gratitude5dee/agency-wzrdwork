import { json } from "../http.js";
import { authenticateRequest } from "../services/auth.js";
import { requireCompanyAccess } from "../services/access.js";
import { getSidebarBadges } from "../services/sidebar-badges.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleSidebarBadgesRoute(context: RouteContext): Promise<RouteResult> {
  const match = context.url.pathname.match(/^\/api\/companies\/([^/]+)\/sidebar-badges$/);
  if (!match || context.request.method !== "GET") {
    return { handled: false };
  }

  const companyId = match[1];
  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, companyId);

  json(context.response, 200, await getSidebarBadges(context.sql, companyId));
  return { handled: true };
}
