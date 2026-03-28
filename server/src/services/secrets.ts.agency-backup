import { createCipheriv, createHash, randomBytes } from "node:crypto";
import type { Sql } from "postgres";
import { asOptionalString, asString, HttpError } from "../http.js";

function getEncryptionKey(): Buffer {
  const raw = process.env.CONTROL_PLANE_ENCRYPTION_KEY ?? process.env.SERVER_ENCRYPTION_KEY;
  if (!raw) {
    throw new HttpError(500, "CONTROL_PLANE_ENCRYPTION_KEY is required");
  }

  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64 = Buffer.from(raw, "base64");
  if (base64.length === 32) {
    return base64;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new HttpError(500, "Encryption key must decode to 32 bytes");
}

function encryptSecretValue(value: string) {
  const encryptionKey = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);

  return {
    algorithm: "aes-256-gcm",
    keyId: null,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    valueSha256: createHash("sha256").update(value, "utf8").digest("hex"),
  };
}

export async function listCompanySecrets(sql: Sql, companyId: string) {
  const normalized = asString(companyId);
  if (!normalized) {
    throw new HttpError(400, "companyId is required");
  }

  return await sql<{
    id: string;
    company_id: string;
    name: string;
    description: string;
    latest_version: number;
    created_at: string;
    updated_at: string;
  }[]>`
    SELECT id, company_id, name, description, latest_version, created_at, updated_at
    FROM public.company_secrets
    WHERE company_id = ${normalized}::uuid
    ORDER BY name ASC
  `;
}

export async function rotateCompanySecret(
  sql: Sql,
  input: {
    companyId: string;
    name: string;
    value: string;
    description?: string | null;
  },
) {
  const companyId = asString(input.companyId);
  const name = asString(input.name);
  const value = asString(input.value);
  if (!companyId || !name || !value) {
    throw new HttpError(400, "companyId, name, and value are required");
  }

  const encrypted = encryptSecretValue(value);

  const rows = await sql<{ secret_id: string | null; version: number | null }[]>`
    SELECT *
    FROM public.rotate_company_secret(
      ${companyId}::uuid,
      ${name},
      ${asOptionalString(input.description)},
      ${encrypted.algorithm},
      ${encrypted.keyId},
      ${encrypted.iv},
      ${encrypted.authTag},
      ${encrypted.ciphertext},
      ${encrypted.valueSha256}
    )
  `;

  return {
    secretId: rows[0]?.secret_id ?? null,
    version: rows[0]?.version ?? null,
    secretRef: {
      kind: "secret_ref" as const,
      secretName: name,
    },
  };
}

export async function deleteCompanySecret(sql: Sql, input: { companyId: string; name: string }) {
  const companyId = asString(input.companyId);
  const name = asString(input.name);
  if (!companyId || !name) {
    throw new HttpError(400, "companyId and name are required");
  }

  await sql`
    DELETE FROM public.company_secrets
    WHERE company_id = ${companyId}::uuid
      AND name = ${name}
  `;
}
