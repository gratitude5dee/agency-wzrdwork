import { HttpError, json, readJson } from "../http.js";
import { requireCompanyAccess, requireCompanyPermission } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import { listIntegrations, upsertIntegration } from "../services/integrations.js";
import type { JsonObject, RouteContext, RouteResult } from "../types.js";

function matchIntegrationPath(pathname: string): { integrationKey: string | null } {
  const match = pathname.match(/^\/api\/integrations\/([^/]+)$/);
  return { integrationKey: match?.[1] ?? null };
}

export async function handleIntegrationsRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method === "GET" && context.url.pathname === "/api/integrations") {
    const companyId = context.url.searchParams.get("companyId");
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const integrations = await listIntegrations(context.sql, companyId);
    json(context.response, 200, { integrations });
    return { handled: true };
  }

  const { integrationKey } = matchIntegrationPath(context.url.pathname);
  if (!integrationKey || context.request.method !== "PATCH") {
    return { handled: false };
  }

  const body = await readJson(context.request);
  const companyId = typeof body.companyId === "string" ? body.companyId : null;
  if (!companyId) throw new HttpError(400, "companyId is required");

  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyPermission(actor, companyId, "manage_integrations");

  const integration = await upsertIntegration(context.sql, {
    companyId,
    integrationKey,
    name: typeof body.name === "string" ? body.name : null,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    config: ((body.config ?? null) as JsonObject | null) ?? undefined,
  });

  context.liveEvents.publish({
    type: "integration.updated",
    companyId,
    payload: {
      integrationKey,
      integrationId: integration.id,
      actorUserId: actor.user.id,
      enabled: integration.enabled === true,
    },
  });

  json(context.response, 200, { integration });
  return { handled: true };
}
