/**
 * useCompanySettings — fetches company info from Supabase
 * using the active-company resolution (wallet → onboarding → company).
 * Also provides a Supabase connection health check and a mutation
 * for updating company profile fields.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveCompany } from "./useActiveCompany";
import { getCompanySettingsRecord, updateCompanySettingsRecord } from "@/lib/server-api/companies";
import { getServerBaseUrl, requestServerJson } from "@/lib/server-api/http";

export interface CompanySettings {
  id: string;
  name: string;
  wallet_address: string | null;
  company_type?: string;
  brand_color?: string;
  brief?: string;
  slug?: string;
  description?: string;
  created_at?: string;
}

/**
 * Fetches the active company row for display in settings.
 * Derives the company from the connected wallet rather than an unscoped limit(1).
 */
export function useCompanySettings() {
  const { companyId, company, isLoading: companyLoading } = useActiveCompany();

  return useQuery<CompanySettings | null>({
    queryKey: ["company-settings", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      if (!companyId) return null;
      return await getCompanySettingsRecord({
        companyId,
        walletAddress: company?.wallet_address ?? null,
      });
    },
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for updating company profile fields (name, brief, company_type, brand_color).
 * Scoped to the active company via companyId.
 */
export function useUpdateCompanySettings() {
  const { companyId, company } = useActiveCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Pick<CompanySettings, "name" | "brief" | "company_type" | "brand_color">>) => {
      if (!companyId) throw new Error("No active company");
      return await updateCompanySettingsRecord({
        companyId,
        walletAddress: company?.wallet_address ?? null,
        patch,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      queryClient.invalidateQueries({ queryKey: ["active-company"] });
    },
  });
}

/**
 * Checks whether the Supabase connection is healthy by running a lightweight query.
 */
export function useSupabaseHealth() {
  const serverBaseUrl = getServerBaseUrl();

  return useQuery<boolean>({
    queryKey: ["server-health"],
    queryFn: async () => {
      try {
        if (!serverBaseUrl) return false;
        const result = await requestServerJson<{ ok: boolean }>("/api/health", { method: "GET" });
        return result.ok === true;
      } catch {
        return false;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}
