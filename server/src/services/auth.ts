import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Sql } from "postgres";
import type { AccessibleCompany, Actor, ServerConfig } from "../types.js";
import { HttpError } from "../http.js";
import { logger } from "../middleware/logger.js";
import {
  ensureUserForWallet,
  resolveActor,
  listAccessibleCompanies,
  selectActiveCompany,
  syncWalletAddressToCompany,
} from "./access.js";

interface AuthSessionRow {
  id: string;
  user_id: string;
  wallet_address: string;
  expires_at: string;
  revoked_at: string | null;
}

type WalletSignatureVerifier = (input: {
  address: string;
  message: string;
  signature: string;
}) => Promise<boolean>;

type ThirdwebAuthModule = {
  verifyEOASignature(input: {
    address: string;
    message: string;
    signature: string;
  }): Promise<boolean>;
};

let walletSignatureVerifierForTest: WalletSignatureVerifier | null = null;

export function setWalletSignatureVerifierForTest(verifier: WalletSignatureVerifier | null) {
  walletSignatureVerifierForTest = verifier;
}

function redactWalletAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function redactNonce(nonce: string): string {
  if (nonce.length <= 8) return nonce;
  return `${nonce.slice(0, 8)}…`;
}

async function verifyWalletSignature(input: {
  address: string;
  message: string;
  signature: string;
}) {
  try {
    if (walletSignatureVerifierForTest) {
      return await walletSignatureVerifierForTest(input);
    }

    const { verifyEOASignature } = await import("thirdweb/auth") as ThirdwebAuthModule;
    return await verifyEOASignature(input);
  } catch (err) {
    logger.warn(
      {
        err,
        errorName: err instanceof Error ? err.name : undefined,
        errorMessage: err instanceof Error ? err.message : undefined,
        walletAddress: redactWalletAddress(input.address),
      },
      "Wallet signature verification failed unexpectedly",
    );
    return false;
  }
}

function normalizeWalletAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildSiweMessage(input: {
  walletAddress: string;
  nonce: string;
  audience: string;
  issuedAt: string;
  expiresAt: string;
}): string {
  return [
    "Agency-Wzrdwork wants you to sign in with your Ethereum account:",
    input.walletAddress,
    "",
    "Sign this message to authenticate with the Agency control plane.",
    "",
    `URI: ${input.audience}`,
    "Version: 1",
    "Chain ID: 1",
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expiresAt}`,
  ].join("\n");
}

function readBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
}

export async function createAuthChallenge(
  sql: Sql,
  config: ServerConfig,
  walletAddress: string,
): Promise<{ message: string; nonce: string; expiresAt: string }> {
  const normalized = normalizeWalletAddress(walletAddress);
  if (!normalized) {
    throw new HttpError(400, "walletAddress is required");
  }

  const nonce = randomBytes(16).toString("hex");
  const now = new Date();
  const issuedAt = now.toISOString();
  const expiresAt = addMinutes(now, config.challengeTtlMinutes).toISOString();
  const message = buildSiweMessage({
    walletAddress: normalized,
    nonce,
    audience: config.audience,
    issuedAt,
    expiresAt,
  });

  await sql`
    INSERT INTO public.auth_challenges (
      wallet_address,
      nonce,
      message,
      issued_at,
      expires_at
    )
    VALUES (
      ${normalized},
      ${nonce},
      ${message},
      ${issuedAt}::timestamptz,
      ${expiresAt}::timestamptz
    )
  `;

  return { message, nonce, expiresAt };
}

export async function verifyAuthChallenge(
  sql: Sql,
  config: ServerConfig,
  input: {
    walletAddress: string;
    nonce: string;
    message: string;
    signature: string;
  },
): Promise<{
  sessionToken: string;
  actor: Actor;
  activeCompany: AccessibleCompany | null;
  accessibleCompanies: AccessibleCompany[];
}> {
  const normalized = normalizeWalletAddress(input.walletAddress);
  if (!normalized || !input.nonce || !input.message || !input.signature) {
    throw new HttpError(400, "walletAddress, nonce, message, and signature are required");
  }

  const challenges = await sql<{
    id: string;
    message: string;
    expires_at: string;
    consumed_at: string | null;
  }[]>`
    SELECT id, message, expires_at, consumed_at
    FROM public.auth_challenges
    WHERE nonce = ${input.nonce}
      AND wallet_address = ${normalized}
    LIMIT 1
  `;

  const challenge = challenges[0];
  if (!challenge) {
    logger.warn(
      { walletAddress: redactWalletAddress(normalized), nonce: redactNonce(input.nonce) },
      "Wallet auth challenge not found",
    );
    throw new HttpError(401, "Auth challenge not found");
  }
  if (challenge.consumed_at) {
    logger.warn(
      { walletAddress: redactWalletAddress(normalized), nonce: redactNonce(input.nonce) },
      "Wallet auth challenge already consumed",
    );
    throw new HttpError(401, "Auth challenge has already been used");
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    logger.warn(
      { walletAddress: redactWalletAddress(normalized), nonce: redactNonce(input.nonce) },
      "Wallet auth challenge expired",
    );
    throw new HttpError(401, "Auth challenge has expired");
  }
  if (challenge.message !== input.message) {
    logger.warn(
      { walletAddress: redactWalletAddress(normalized), nonce: redactNonce(input.nonce) },
      "Wallet auth challenge message mismatch",
    );
    throw new HttpError(401, "Auth challenge message mismatch");
  }

  const verified = await verifyWalletSignature({
    address: normalized,
    message: input.message,
    signature: input.signature,
  });
  if (!verified) {
    logger.warn(
      { walletAddress: redactWalletAddress(normalized), nonce: redactNonce(input.nonce) },
      "Wallet auth signature rejected",
    );
    throw new HttpError(401, "Signature verification failed");
  }
  logger.info(
    { walletAddress: redactWalletAddress(normalized), nonce: redactNonce(input.nonce) },
    "Wallet auth signature verified",
  );

  await sql`
    UPDATE public.auth_challenges
    SET consumed_at = now()
    WHERE id = ${challenge.id}::uuid
  `;

  try {
    const user = await ensureUserForWallet(sql, normalized);
    await syncWalletAddressToCompany(sql, normalized);
    const actor = await resolveActor(sql, { walletAddress: normalized });
    const accessibleCompanies = await listAccessibleCompanies(sql, actor);
    const activeCompany = selectActiveCompany(accessibleCompanies, null);

    const sessionToken = randomBytes(32).toString("hex");
    const expiresAt = addDays(new Date(), config.sessionTtlDays).toISOString();

    await sql`
      INSERT INTO public.auth_sessions (
        user_id,
        wallet_address,
        session_token_sha256,
        expires_at,
        last_seen_at
      )
      VALUES (
        ${user.id}::uuid,
        ${normalized},
        ${sha256(sessionToken)},
        ${expiresAt}::timestamptz,
        now()
      )
    `;

    logger.info(
      { walletAddress: redactWalletAddress(normalized), userId: user.id },
      "Wallet auth session created",
    );

    return {
      sessionToken,
      actor,
      activeCompany,
      accessibleCompanies,
    };
  } catch (err) {
    logger.error(
      {
        err,
        walletAddress: redactWalletAddress(normalized),
        nonce: redactNonce(input.nonce),
      },
      "Wallet auth session creation failed",
    );
    throw err;
  }
}

export async function authenticateSessionToken(
  sql: Sql,
  config: ServerConfig,
  sessionToken: string,
): Promise<{ actor: Actor; walletAddress: string }> {
  const tokenHash = sha256(sessionToken);
  const sessions = await sql<AuthSessionRow[]>`
    SELECT id, user_id, wallet_address, expires_at, revoked_at
    FROM public.auth_sessions
    WHERE session_token_sha256 = ${tokenHash}
    LIMIT 1
  `;

  const session = sessions[0];
  if (!session || session.revoked_at) {
    throw new HttpError(401, "Session is invalid");
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    throw new HttpError(401, "Session has expired");
  }

  const nextExpiry = addDays(new Date(), config.sessionTtlDays).toISOString();
  await sql`
    UPDATE public.auth_sessions
    SET last_seen_at = now(),
        expires_at = ${nextExpiry}::timestamptz
    WHERE id = ${session.id}::uuid
  `;

  const actor = await resolveActor(sql, { walletAddress: session.wallet_address });
  return { actor, walletAddress: session.wallet_address };
}

export async function authenticateRequest(
  sql: Sql,
  config: ServerConfig,
  request: IncomingMessage,
): Promise<{ actor: Actor; walletAddress: string; authMode: "session" | "dev_header" }> {
  const bearerToken = readBearerToken(request);
  if (bearerToken) {
    const { actor, walletAddress } = await authenticateSessionToken(sql, config, bearerToken);
    return { actor, walletAddress, authMode: "session" };
  }

  if (config.trustWalletHeader) {
    const walletHeader = request.headers["x-wallet-address"];
    const walletAddress = typeof walletHeader === "string" ? normalizeWalletAddress(walletHeader) : null;
    if (walletAddress) {
      const actor = await resolveActor(sql, { walletAddress });
      return { actor, walletAddress, authMode: "dev_header" };
    }
  }

  throw new HttpError(401, "Authentication is required");
}

export async function revokeSessionToken(sql: Sql, sessionToken: string): Promise<void> {
  await sql`
    UPDATE public.auth_sessions
    SET revoked_at = now()
    WHERE session_token_sha256 = ${sha256(sessionToken)}
      AND revoked_at IS NULL
  `;
}

export async function resolveAccessPayload(
  sql: Sql,
  actor: Actor,
  preferredCompanyId: string | null,
): Promise<{
  actor: Actor;
  activeCompany: AccessibleCompany | null;
  accessibleCompanies: AccessibleCompany[];
}> {
  const accessibleCompanies = await listAccessibleCompanies(sql, actor);
  return {
    actor,
    activeCompany: selectActiveCompany(accessibleCompanies, preferredCompanyId),
    accessibleCompanies,
  };
}

export function readSessionTokenFromRequest(request: IncomingMessage): string | null {
  return readBearerToken(request);
}
