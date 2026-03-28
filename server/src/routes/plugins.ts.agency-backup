import { HttpError, json, readJson } from "../http.js";
import { requireCompanyAccess, requireCompanyPermission } from "../services/access.js";
import { authenticateRequest } from "../services/auth.js";
import {
  getCompanyPlugin,
  installCompanyPlugin,
  listCompanyPlugins,
  uninstallCompanyPlugin,
  updateCompanyPlugin,
} from "../services/plugins.js";
import type { JsonObject, RouteContext, RouteResult } from "../types.js";

function matchPluginPath(pathname: string): { pluginId: string | null } {
  const match = pathname.match(/^\/api\/plugins\/([^/]+)$/);
  return { pluginId: match?.[1] ?? null };
}

export async function handlePluginsRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method === "GET" && context.url.pathname === "/api/plugins") {
    const companyId = context.url.searchParams.get("companyId");
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const plugins = await listCompanyPlugins(context.sql, companyId);
    json(context.response, 200, { plugins });
    return { handled: true };
  }

  if (context.request.method === "POST" && context.url.pathname === "/api/plugins") {
    const body = await readJson(context.request);
    const companyId = typeof body.companyId === "string" ? body.companyId : null;
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyPermission(actor, companyId, "manage_company");

    const plugin = await installCompanyPlugin(context.sql, {
      companyId,
      actorUserId: actor.user.id,
      slug: String(body.slug ?? ""),
      name: String(body.name ?? ""),
      version: String(body.version ?? ""),
      description: typeof body.description === "string" ? body.description : null,
      packageName: typeof body.packageName === "string" ? body.packageName : null,
      entrypoint: typeof body.entrypoint === "string" ? body.entrypoint : null,
      manifest: ((body.manifest ?? null) as JsonObject | null) ?? undefined,
      config: ((body.config ?? null) as JsonObject | null) ?? undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : false,
    });

    context.liveEvents.publish({
      type: "plugin.updated",
      companyId,
      payload: {
        actorUserId: actor.user.id,
        pluginId: plugin.id,
        action: "installed",
        enabled: plugin.enabled,
      },
    });

    json(context.response, 201, { plugin });
    return { handled: true };
  }

  const { pluginId } = matchPluginPath(context.url.pathname);
  if (!pluginId) return { handled: false };

  if (context.request.method === "GET") {
    const companyId = context.url.searchParams.get("companyId");
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyAccess(actor, companyId);

    const plugin = await getCompanyPlugin(context.sql, companyId, pluginId);
    if (!plugin) throw new HttpError(404, "Plugin not found");

    json(context.response, 200, { plugin });
    return { handled: true };
  }

  if (context.request.method === "PATCH") {
    const body = await readJson(context.request);
    const companyId = typeof body.companyId === "string" ? body.companyId : null;
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyPermission(actor, companyId, "manage_company");

    const plugin = await updateCompanyPlugin(context.sql, {
      companyId,
      pluginId,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      status: typeof body.status === "string" ? body.status : undefined,
      config: ((body.config ?? null) as JsonObject | null) ?? undefined,
    });

    context.liveEvents.publish({
      type: "plugin.updated",
      companyId,
      payload: {
        actorUserId: actor.user.id,
        pluginId: plugin.id,
        action: "updated",
        enabled: plugin.enabled,
        status: plugin.status,
      },
    });

    json(context.response, 200, { plugin });
    return { handled: true };
  }

  if (context.request.method === "DELETE") {
    const companyId = context.url.searchParams.get("companyId");
    if (!companyId) throw new HttpError(400, "companyId is required");

    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    requireCompanyPermission(actor, companyId, "manage_company");

    const plugin = await uninstallCompanyPlugin(context.sql, companyId, pluginId);

    context.liveEvents.publish({
      type: "plugin.updated",
      companyId,
      payload: {
        actorUserId: actor.user.id,
        pluginId: plugin.id,
        action: "uninstalled",
        enabled: false,
      },
    });

    json(context.response, 200, { plugin });
    return { handled: true };
  }

  return { handled: false };
}
