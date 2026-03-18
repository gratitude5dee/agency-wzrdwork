/**
 * useCompanySettings — fetches company info from Supabase
 * using the active-company resolution (wallet → onboarding → company).
 * Also provides a Supabase connection health check and a mutation
 * for updating company profile fields.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "./useActiveCompany";

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
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  return useQuery<CompanySettings | null>({
    queryKey: ["company-settings", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from("companies")
        .select("id, name, wallet_address, company_type, brand_color, brief, slug, description, created_at")
        .eq("id", companyId)
        .maybeSingle();

      if (error) {
        // Table may not exist yet
        if (error.code === "42P01" || error.message?.includes("does not exist")) {
          return null;
        }
        throw error;
      }
      return data as CompanySettings | null;
    },
    staleTime: 30_000,
  });
}

/**
 * Mutation hook for updating company profile fields (name, brief, company_type, brand_color).
 * Scoped to the active company via companyId.
 */
export function useUpdateCompanySettings() {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<Pick<CompanySettings, "name" | "brief" | "company_type" | "brand_color">>) => {
      if (!companyId) throw new Error("No active company");

      const { data, error } = await supabase
        .from("companies")
        .update(patch)
        .eq("id", companyId)
        .select("id, name, wallet_address, company_type, brand_color, brief, slug, description, created_at")
        .single();

      if (error) throw error;
      return data as CompanySettings;
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
  return useQuery<boolean>({
    queryKey: ["supabase-health"],
    queryFn: async () => {
      try {
        // Simple select to verify connection — agents table should always exist
        const { error } = await supabase
          .from("agents")
          .select("id")
          .limit(1);

        return !error;
      } catch {
        return false;
      }
    },
    staleTime: 60_000,
    retry: 1,
  });
}
