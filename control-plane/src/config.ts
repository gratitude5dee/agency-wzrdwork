import { randomUUID } from "node:crypto";

function parseAllowlist(value: string | undefined, fallback: string[]): string[] {
  const parsed = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

function parseInteger(value: string | undefined, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
}

function decodeEncryptionKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error("CONTROL_PLANE_ENCRYPTION_KEY is required");
  }

  const trimmed = raw.trim();
  const encodings: BufferEncoding[] = ["base64", "hex", "utf8"];
  for (const encoding of encodings) {
    try {
      const decoded = Buffer.from(trimmed, encoding);
      if (decoded.length === 32) return decoded;
    } catch {
      // Ignore and try the next encoding.
    }
  }

  throw new Error(
    "CONTROL_PLANE_ENCRYPTION_KEY must decode to 32 bytes (base64, hex, or raw utf8)",
  );
}

export interface ControlPlaneConfig {
  databaseUrl: string;
  disablePreparedStatements: boolean;
  workerId: string;
  pollIntervalMs: number;
  schedulerIntervalMs: number;
  staleClaimMs: number;
  maxAttempts: number;
  allowedProcessCommands: string[];
  allowedCodexCommands: string[];
  defaultCodexCommand: string;
  encryptionKey: Buffer;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return {
    databaseUrl,
    disablePreparedStatements: parseBoolean(
      env.PAPERCLIP_DB_DISABLE_PREPARED_STATEMENTS,
      false,
    ),
    workerId: env.CONTROL_PLANE_WORKER_ID?.trim() || randomUUID(),
    pollIntervalMs: Math.max(250, parseInteger(env.CONTROL_PLANE_POLL_INTERVAL_MS, 1500)),
    schedulerIntervalMs: Math.max(
      1_000,
      parseInteger(env.CONTROL_PLANE_SCHEDULER_INTERVAL_MS, 10_000),
    ),
    staleClaimMs: Math.max(
      30_000,
      parseInteger(env.CONTROL_PLANE_STALE_CLAIM_MS, 5 * 60_000),
    ),
    maxAttempts: Math.max(1, parseInteger(env.CONTROL_PLANE_MAX_ATTEMPTS, 2)),
    allowedProcessCommands: parseAllowlist(
      env.CONTROL_PLANE_ALLOWED_PROCESS_COMMANDS,
      ["node", "bash", "sh", "python", "python3"],
    ),
    allowedCodexCommands: parseAllowlist(
      env.CONTROL_PLANE_ALLOWED_CODEX_COMMANDS,
      ["codex"],
    ),
    defaultCodexCommand: env.CONTROL_PLANE_DEFAULT_CODEX_COMMAND?.trim() || "codex",
    encryptionKey: decodeEncryptionKey(env.CONTROL_PLANE_ENCRYPTION_KEY),
  };
}
