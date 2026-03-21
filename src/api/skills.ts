import { apiClient } from "./client";

export const skillsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/skills`),
  create: (companyId: string, data: unknown) => apiClient.post<unknown>(`/api/companies/${companyId}/skills`, data),
  update: (companyId: string, id: string, data: unknown) =>
    apiClient.patch<unknown>(`/api/companies/${companyId}/skills/${id}`, data),
  delete: (companyId: string, id: string) => apiClient.delete<void>(`/api/companies/${companyId}/skills/${id}`),
};
