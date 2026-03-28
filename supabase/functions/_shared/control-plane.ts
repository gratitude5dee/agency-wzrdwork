import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function decodeEncryptionKey(raw: string | undefined): Uint8Array {
  if (!raw) {
    throw new Error("CONTROL_PLANE_ENCRYPTION_KEY is required");
  }

  const trimmed = raw.trim();
  try {
    const base64 = decodeBase64(trimmed);
    if (base64.length === 32) return base64;
  } catch {
    // Ignore; not valid base64.
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const output = new Uint8Array(32);
    for (let i = 0; i < trimmed.length; i += 2) {
      output[i / 2] = Number.parseInt(trimmed.slice(i, i + 2), 16);
    }
    return output;
  }

  const utf8 = new TextEncoder().encode(trimmed);
  if (utf8.length === 32) return utf8;

  throw new Error(
    "CONTROL_PLANE_ENCRYPTION_KEY must decode to 32 bytes (base64, hex, or utf8)",
  );
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function encryptSecretValue(
  plaintext: string,
  rawKey: Uint8Array,
): Promise<{
  algorithm: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  valueSha256: string;
}> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawKey.buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      cryptoKey,
      new TextEncoder().encode(plaintext),
    ),
  );

  const tagLength = 16;
  const ciphertext = encrypted.slice(0, encrypted.length - tagLength);
  const authTag = encrypted.slice(encrypted.length - tagLength);

  return {
    algorithm: "aes-256-gcm",
    iv: encodeBase64(iv),
    authTag: encodeBase64(authTag),
    ciphertext: encodeBase64(ciphertext),
    valueSha256: await sha256Hex(plaintext),
  };
}
