import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError, isOptionsRequest, json, withCors } from "./http.js";
import type { AppContext } from "./types.js";
import { handleHealthRoute } from "./routes/health.js";
import { handleAuthRoute } from "./routes/auth.js";
import { handleAccessRoute } from "./routes/access.js";
import { handleAgentsRoute } from "./routes/agents.js";
import { handleAgencyRoute } from "./routes/agency.js";
import { handleApprovalsRoute } from "./routes/approvals.js";
import { handleActivityRoute } from "./routes/activity.js";
import { handleDashboardRoute } from "./routes/dashboard.js";
import { handleCompaniesRoute } from "./routes/companies.js";
import { handleIntegrationsRoute } from "./routes/integrations.js";
import { handleIssuesRoute } from "./routes/issues.js";
import { handleSecretsRoute } from "./routes/secrets.js";
import { handleGoalsRoute } from "./routes/goals.js";
import { handleProjectsRoute } from "./routes/projects.js";
import { handleCostsRoute } from "./routes/costs.js";
import { handleSidebarBadgesRoute } from "./routes/sidebar-badges.js";
import { handleInstanceSettingsRoute } from "./routes/instance-settings.js";
import { handlePluginsRoute } from "./routes/plugins.js";

type Handler = (context: {
  config: AppContext["config"];
  sql: AppContext["sql"];
  liveEvents: AppContext["liveEvents"];
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
}) => Promise<{ handled: boolean }>;

const ROUTES: Handler[] = [
  handleHealthRoute,
  handleAuthRoute,
  handleAccessRoute,
  handleAgentsRoute,
  handleAgencyRoute,
  handleApprovalsRoute,
  handleActivityRoute,
  handleDashboardRoute,
  handleCompaniesRoute,
  handleIntegrationsRoute,
  handleIssuesRoute,
  handleSecretsRoute,
  handleGoalsRoute,
  handleProjectsRoute,
  handleCostsRoute,
  handleSidebarBadgesRoute,
  handleInstanceSettingsRoute,
  handlePluginsRoute,
];

export function createApp(context: AppContext) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    withCors(request, response, context.config.allowedOrigin);

    if (isOptionsRequest(request)) {
      response.statusCode = 204;
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? context.config.host}`);

    try {
      for (const route of ROUTES) {
        const result = await route({
          ...context,
          request,
          response,
          url,
        });
        if (result.handled) return;
      }

      json(response, 404, {
        error: "Route not found",
        path: url.pathname,
      });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof Error ? error.message : "Unexpected server error";
      json(response, status, { error: message });
    }
  };
}
