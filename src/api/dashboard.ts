import { apiClient } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => apiClient.get<unknown>(`/api/companies/${companyId}/dashboard`),
};
