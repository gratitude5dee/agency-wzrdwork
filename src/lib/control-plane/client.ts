import { requestServerJson } from "@/lib/server-api/http";

export interface EnqueueWakeupInput {
  agentId: string;
  companyId?: string;
  walletAddress?: string | null;
  reason?: string;
  payload?: Record<string, unknown>;
}

export interface EnqueueWakeupResult {
  wakeupRequestId: string | null;
  heartbeatRunId: string | null;
  status: string;
}

export interface CompanySecretSummary {
  id: string;
  company_id: string;
  name: string;
  description: string;
  latest_version: number;
  created_at: string;
  updated_at: string;
}

export async function enqueueAgentWakeup(
  input: EnqueueWakeupInput,
): Promise<EnqueueWakeupResult> {
  return requestServerJson<EnqueueWakeupResult>(`/api/agents/${input.agentId}/wakeup`, {
    method: "POST",
    actor: {
      walletAddress: input.walletAddress,
      companyId: input.companyId ?? null,
    },
    body: {
      reason: input.reason,
      payload: input.payload ?? {},
    },
  });
}

export async function listCompanySecrets(
  companyId: string,
  walletAddress?: string | null,
): Promise<CompanySecretSummary[]> {
  const data = await requestServerJson<{ secrets: CompanySecretSummary[] }>(
    `/api/secrets?companyId=${encodeURIComponent(companyId)}`,
    {
      method: "GET",
      actor: {
        companyId,
        walletAddress,
      },
    },
  );
  return (data?.secrets ?? []) as CompanySecretSummary[];
}

export async function rotateCompanySecret(input: {
  companyId: string;
  walletAddress?: string | null;
  name: string;
  value: string;
  description?: string;
}): Promise<{ secretId: string | null; version: number | null; secretRef: { kind: "secret_ref"; secretName: string } }> {
  return requestServerJson<{
    secretId: string | null;
    version: number | null;
    secretRef: { kind: "secret_ref"; secretName: string };
  }>("/api/secrets", {
    method: "POST",
    actor: {
      companyId: input.companyId,
      walletAddress: input.walletAddress,
    },
    body: input,
  });
}

export async function deleteCompanySecret(input: {
  companyId: string;
  walletAddress?: string | null;
  name: string;
}): Promise<void> {
  await requestServerJson<unknown>("/api/secrets", {
    method: "DELETE",
    actor: {
      companyId: input.companyId,
      walletAddress: input.walletAddress,
    },
    body: input,
  });
}
