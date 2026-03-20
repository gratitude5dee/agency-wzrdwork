import { HttpError, json, readJson } from "../http.js";
import { getCompanySettings, updateCompanySettings } from "../services/companies.js";
import { requireCompanyAccess, requireCompanyPermission } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import type { RouteContext, RouteResult } from "../types.js";

function matchCompanyPath(pathname: string): { companyId: string | null } {
  const match = pathname.match(/^\/api\/companies\/([^/]+)$/);
  return { companyId: match?.[1] ?? null };
}

export async function handleCompaniesRoute(context: RouteContext): Promise<RouteResult> {
  const { companyId } = matchCompanyPath(context.url.pathname);
  if (!companyId) return { handled: false };

  const { actor } = await authenticateRequest(context.sql, context.config, context.request);

  if (context.request.method === "GET") {
    requireCompanyAccess(actor, companyId);
    const company = await getCompanySettings(context.sql, companyId);
    if (!company) {
      throw new HttpError(404, "Company not found");
    }
    json(context.response, 200, { company });
    return { handled: true };
  }

  if (context.request.method === "PATCH") {
    requireCompanyPermission(actor, companyId, "manage_company");
    const body = await readJson(context.request);
    const company = await updateCompanySettings(context.sql, companyId, {
      name: typeof body.name === "string" ? body.name : null,
      brief: typeof body.brief === "string" ? body.brief : null,
      company_type: typeof body.company_type === "string" ? body.company_type : null,
      brand_color: typeof body.brand_color === "string" ? body.brand_color : null,
    });

    context.liveEvents.publish({
      type: "company.updated",
      companyId,
      payload: { actorUserId: actor.user.id, companyId },
    });

    json(context.response, 200, { company });
    return { handled: true };
  }

  return { handled: false };
}
