import { apiClient } from "./client";

export const issuesApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/issues`),
  get: (companyId: string, id: string) => apiClient.get<unknown>(`/api/companies/${companyId}/issues/${id}`),
  create: (companyId: string, data: unknown) => apiClient.post<unknown>(`/api/companies/${companyId}/issues`, data),
  update: (companyId: string, id: string, data: unknown) => apiClient.patch<unknown>(`/api/companies/${companyId}/issues/${id}`, data),
};
