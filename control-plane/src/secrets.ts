import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import type { AdapterResolution, JsonObject } from "./types.js";
import { asObject, asString } from "./utils.js";

export interface SecretRefIdentifier {
  key: string;
  candidates: string[];
}

export interface SecretVersionRow {
  secret_id: string;
  name: string;
  algorithm: string;
  key_id: string | null;
  iv: string;
  auth_tag: string;
  ciphertext: string;
}

function isSecretRef(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const kind = asString(record.kind) || asString(record.type);
  return kind === "secret_ref";
}

function extractCandidates(value: Record<string, unknown>): string[] {
  const candidates = [
    asString(value.secretName),
    asString(value.secretId),
    asString(value.name),
    asString(value.id),
  ].filter(Boolean);
  return Array.from(new Set(candidates));
}

export function collectSecretIdentifiers(
  value: unknown,
  found = new Map<string, SecretRefIdentifier>(),
): Map<string, SecretRefIdentifier> {
  if (!value) return found;

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSecretIdentifiers(item, found);
    }
    return found;
  }

  if (typeof value !== "object") return found;

  if (isSecretRef(value)) {
    const record = value as Record<string, unknown>;
    const candidates = extractCandidates(record);
    if (candidates.length > 0) {
      const key = candidates[0];
      found.set(key, { key, candidates });
    }
    return found;
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectSecretIdentifiers(item, found);
  }
  return found;
}

export function resolveSecretRefs(
  value: unknown,
  secretValues: Map<string, string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveSecretRefs(item, secretValues));
  }

  if (!value || typeof value !== "object") return value;

  if (isSecretRef(value)) {
    const record = value as Record<string, unknown>;
    for (const candidate of extractCandidates(record)) {
      const resolved = secretValues.get(candidate);
      if (resolved !== undefined) return resolved;
    }
    throw new Error("Missing secret value for secret_ref binding");
  }

  if ("type" in (value as Record<string, unknown>) && !("kind" in (value as Record<string, unknown>))) {
    const record = value as Record<string, unknown>;
    if (record.type === "plain" && typeof record.value === "string") {
      return record.value;
    }
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = resolveSecretRefs(item, secretValues);
  }
  return output;
}

export async function loadSecretValues(
  sql: Sql,
  companyId: string,
  encryptionKey: Buffer,
  identifiers: string[],
): Promise<Map<string, string>> {
  if (identifiers.length === 0) return new Map();

  const uniqueIdentifiers = Array.from(new Set(identifiers.filter(Boolean)));
  const rows = await sql<SecretVersionRow[]>`
    SELECT
      cs.id AS secret_id,
      cs.name,
      csv.algorithm,
      csv.key_id,
      csv.iv,
      csv.auth_tag,
      csv.ciphertext
    FROM public.company_secrets cs
    JOIN public.company_secret_versions csv
      ON csv.secret_id = cs.id
     AND csv.version = cs.latest_version
    WHERE cs.company_id = ${companyId}
      AND (
        cs.name = ANY(${sql.array(uniqueIdentifiers)})
        OR cs.id::text = ANY(${sql.array(uniqueIdentifiers)})
      )
  `;

  const resolved = new Map<string, string>();
  for (const row of rows) {
    const plaintext = decryptSecretValue(
      {
        algorithm: row.algorithm,
        iv: row.iv,
        authTag: row.auth_tag,
        ciphertext: row.ciphertext,
      },
      encryptionKey,
    );
    resolved.set(row.name, plaintext);
    resolved.set(row.secret_id, plaintext);
  }
  return resolved;
}

export async function resolveAdapterConfigSecrets(
  sql: Sql,
  companyId: string,
  encryptionKey: Buffer,
  rawConfig: JsonObject,
): Promise<AdapterResolution> {
  const identifiers = Array.from(collectSecretIdentifiers(rawConfig).values()).flatMap(
    (entry) => entry.candidates,
  );
  const secretValues = await loadSecretValues(sql, companyId, encryptionKey, identifiers);
  const sensitiveValues = Array.from(new Set(secretValues.values()));
  return {
    config: asObject(resolveSecretRefs(rawConfig, secretValues)),
    sensitiveValues,
  };
}

export function encryptSecretValue(
  plaintext: string,
  encryptionKey: Buffer,
): {
  algorithm: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  valueSha256: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);

  return {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    valueSha256: createHash("sha256").update(plaintext, "utf8").digest("hex"),
  };
}

export function decryptSecretValue(
  input: {
    algorithm: string;
    iv: string;
    authTag: string;
    ciphertext: string;
  },
  encryptionKey: Buffer,
): string {
  if (input.algorithm !== "aes-256-gcm") {
    throw new Error(`Unsupported secret algorithm: ${input.algorithm}`);
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(input.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(input.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
