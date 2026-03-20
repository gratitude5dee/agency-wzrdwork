import { useQuery } from "@tanstack/react-query";
import { getAccessMe, type AccessibleCompany } from "@/lib/server-api/auth";

export interface ActiveCompany extends AccessibleCompany {}

const ACTIVE_COMPANY_QUERY_KEY = ["active-company"] as const;

export async function resolveActiveCompany(): Promise<ActiveCompany | null> {
  try {
    const access = await getAccessMe();
    return access.activeCompany;
  } catch {
    return null;
  }
}

export function useActiveCompany() {
  const {
    data: company = null,
    isLoading,
    error,
  } = useQuery<ActiveCompany | null>({
    queryKey: ACTIVE_COMPANY_QUERY_KEY,
    queryFn: resolveActiveCompany,
    staleTime: 30_000,
  });

  return {
    company,
    companyId: company?.id ?? null,
    isLoading,
    error,
  };
}
