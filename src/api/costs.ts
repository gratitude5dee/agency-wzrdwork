import { apiClient } from "./client";

export const costsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/costs`),
  summary: (companyId: string) => apiClient.get<unknown>(`/api/companies/${companyId}/costs/summary`),
};
