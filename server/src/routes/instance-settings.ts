import { json, readJson } from "../http.js";
import { authenticateRequest } from "../services/auth.js";
import { listInstanceSettingsCompanyIds, getInstanceExperimentalSettings, updateInstanceExperimentalSettings } from "../services/instance-settings.js";
import { recordActivity } from "../services/activity-log.js";
import { requireInstanceAdmin } from "../services/access.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleInstanceSettingsRoute(context: RouteContext): Promise<RouteResult> {
  if (context.url.pathname !== "/api/instance/settings/experimental") {
    return { handled: false };
  }

  const { actor } = await authenticateRequest(context.sql, context.config, context.request);
  requireInstanceAdmin(actor);

  if (context.request.method === "GET") {
    json(context.response, 200, await getInstanceExperimentalSettings(context.sql));
    return { handled: true };
  }

  if (context.request.method === "PATCH") {
    const body = await readJson(context.request);
    const updated = await updateInstanceExperimentalSettings(context.sql, {
      enableIsolatedWorkspaces:
        body.enableIsolatedWorkspaces === undefined
          ? undefined
          : body.enableIsolatedWorkspaces === true,
    });

    const companyIds = await listInstanceSettingsCompanyIds(context.sql);
    await Promise.all(
      companyIds.map((companyId) =>
        recordActivity(context.sql, {
          companyId,
          action: "instance.settings.experimental_updated",
          details: {
            experimental: updated,
            changedKeys: Object.keys(body).sort(),
          },
        }),
      ),
    );

    json(context.response, 200, updated);
    return { handled: true };
  }

  return { handled: false };
}
