import { requestServerJson, requestServerVoid } from "./http";
import { clearServerSessionToken, setServerSessionToken } from "./session";

export interface AccessibleCompany {
  id: string;
  name: string;
  slug: string;
  wallet_address: string | null;
}

export interface AuthActor {
  user: {
    id: string;
    wallet_address: string;
    display_name: string | null;
  };
  memberships: Array<{
    company_id: string;
    role: string;
    permissions: Record<string, unknown>;
    status: string;
  }>;
  instanceRoles: string[];
}

export interface AuthChallengeResponse {
  message: string;
  nonce: string;
  expiresAt: string;
}

export interface AuthVerifyResponse {
  sessionToken: string;
  actor: AuthActor;
  activeCompany: AccessibleCompany | null;
  accessibleCompanies: AccessibleCompany[];
}

export interface AccessMeResponse {
  actor: AuthActor;
  activeCompany: AccessibleCompany | null;
  accessibleCompanies: AccessibleCompany[];
  memberships: AuthActor["memberships"];
  instanceRoles: string[];
}

export async function requestAuthChallenge(walletAddress: string): Promise<AuthChallengeResponse> {
  return await requestServerJson<AuthChallengeResponse>("/api/auth/challenge", {
    method: "POST",
    body: { walletAddress },
  });
}

export async function verifyAuthChallenge(input: {
  walletAddress: string;
  nonce: string;
  message: string;
  signature: string;
}): Promise<AuthVerifyResponse> {
  const result = await requestServerJson<AuthVerifyResponse>("/api/auth/verify", {
    method: "POST",
    body: input,
  });
  setServerSessionToken(result.sessionToken);
  return result;
}

export async function logoutServerSession(): Promise<void> {
  try {
    await requestServerVoid("/api/auth/logout", { method: "POST" });
  } finally {
    clearServerSessionToken();
  }
}

export async function getAccessMe(companyId?: string | null): Promise<AccessMeResponse> {
  const suffix = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  return await requestServerJson<AccessMeResponse>(`/api/access/me${suffix}`, {
    method: "GET",
  });
}
