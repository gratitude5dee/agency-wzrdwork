import { json } from "../http.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleHealthRoute(context: RouteContext): Promise<RouteResult> {
  if (context.request.method !== "GET" || context.url.pathname !== "/api/health") {
    return { handled: false };
  }

  json(context.response, 200, {
    ok: true,
    service: "agency-orchestration-server",
    time: new Date().toISOString(),
  });
  return { handled: true };
}
