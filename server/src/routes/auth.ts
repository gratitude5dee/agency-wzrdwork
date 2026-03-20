import { json, noContent, readJson, HttpError } from "../http.js";
import {
  authenticateRequest,
  createAuthChallenge,
  readSessionTokenFromRequest,
  resolveAccessPayload,
  revokeSessionToken,
  verifyAuthChallenge,
} from "../services/auth.js";
import type { RouteContext, RouteResult } from "../types.js";

export async function handleAuthRoute(context: RouteContext): Promise<RouteResult> {
  if (context.url.pathname === "/api/auth/challenge" && context.request.method === "POST") {
    const body = await readJson(context.request);
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : null;
    if (!walletAddress) {
      throw new HttpError(400, "walletAddress is required");
    }

    const challenge = await createAuthChallenge(context.sql, context.config, walletAddress);
    json(context.response, 200, challenge);
    return { handled: true };
  }

  if (context.url.pathname === "/api/auth/verify" && context.request.method === "POST") {
    const body = await readJson(context.request);
    const result = await verifyAuthChallenge(context.sql, context.config, {
      walletAddress: typeof body.walletAddress === "string" ? body.walletAddress : "",
      nonce: typeof body.nonce === "string" ? body.nonce : "",
      message: typeof body.message === "string" ? body.message : "",
      signature: typeof body.signature === "string" ? body.signature : "",
    });

    json(context.response, 200, result);
    return { handled: true };
  }

  if (context.url.pathname === "/api/auth/logout" && context.request.method === "POST") {
    const sessionToken = readSessionTokenFromRequest(context.request);
    if (sessionToken) {
      await revokeSessionToken(context.sql, sessionToken);
    }
    noContent(context.response);
    return { handled: true };
  }

  if (context.url.pathname === "/api/auth/session" && context.request.method === "GET") {
    const companyId = context.url.searchParams.get("companyId");
    const { actor } = await authenticateRequest(context.sql, context.config, context.request);
    const payload = await resolveAccessPayload(context.sql, actor, companyId);
    json(context.response, 200, payload);
    return { handled: true };
  }

  return { handled: false };
}
