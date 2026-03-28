import { json, noContent, readJson, HttpError } from "../http.js";
import { requireCompanyAccess } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import { deleteCompanySecret, listCompanySecrets, rotateCompanySecret } from "../services/secrets.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleSecretsRoute(context: RouteContext): Promise<RouteResult> {
  if (context.url.pathname !== "/api/secrets") {
    return { handled: false };
  }

  if (context.request.method === "GET") {
    const companyId = context.url.searchParams.get("companyId");
    if (!companyId) throw new HttpError(400, "companyId is required");
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const secrets = await listCompanySecrets(context.sql, companyId);
    json(context.response, 200, { secrets });
    return { handled: true };
  }

  const body = await readJson(context.request);
  const companyId = typeof body.companyId === "string" ? body.companyId : null;
  if (!companyId) throw new HttpError(400, "companyId is required");
  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireCompanyAccess(actor, companyId);

  if (context.request.method === "POST") {
    const rotated = await rotateCompanySecret(context.sql, {
      companyId,
      name: String(body.name ?? ""),
      value: String(body.value ?? ""),
      description: typeof body.description === "string" ? body.description : null,
    });

    context.liveEvents.publish({
      type: "secret.rotated",
      companyId,
      payload: { name: String(body.name ?? ""), actorUserId: actor.user.id },
    });

    json(context.response, 200, rotated);
    return { handled: true };
  }

  if (context.request.method === "DELETE") {
    await deleteCompanySecret(context.sql, {
      companyId,
      name: String(body.name ?? ""),
    });

    context.liveEvents.publish({
      type: "secret.deleted",
      companyId,
      payload: { name: String(body.name ?? ""), actorUserId: actor.user.id },
    });

    noContent(context.response);
    return { handled: true };
  }

  return { handled: false };
}
