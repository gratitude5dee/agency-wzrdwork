import type { ServerConfig } from "./types.js";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.SERVER_PORT ?? env.PORT ?? 8787);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("SERVER_PORT must be a positive integer");
  }

  const challengeTtlMinutes = Number(env.SERVER_CHALLENGE_TTL_MINUTES ?? 10);
  const sessionTtlDays = Number(env.SERVER_SESSION_TTL_DAYS ?? 7);

  return {
    host: env.SERVER_HOST ?? "127.0.0.1",
    port,
    databaseUrl: requireEnv("DATABASE_URL", env.DATABASE_URL),
    allowedOrigin: env.SERVER_ALLOWED_ORIGIN ?? "*",
    trustWalletHeader:
      env.SERVER_TRUST_WALLET_HEADER === "true",
    websocketPath: env.SERVER_WEBSOCKET_PATH ?? "/ws/live",
    audience:
      env.SERVER_AUDIENCE ??
      env.SERVER_ALLOWED_ORIGIN ??
      `http://${env.SERVER_HOST ?? "127.0.0.1"}:${port}`,
    challengeTtlMinutes: Number.isFinite(challengeTtlMinutes) && challengeTtlMinutes > 0
      ? challengeTtlMinutes
      : 10,
    sessionTtlDays: Number.isFinite(sessionTtlDays) && sessionTtlDays > 0
      ? sessionTtlDays
      : 7,
  };
}
