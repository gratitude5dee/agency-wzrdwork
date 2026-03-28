import { apiClient } from "./client";

export const goalsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/goals`),
  get: (companyId: string, id: string) => apiClient.get<unknown>(`/api/companies/${companyId}/goals/${id}`),
  create: (companyId: string, data: unknown) => apiClient.post<unknown>(`/api/companies/${companyId}/goals`, data),
  update: (companyId: string, id: string, data: unknown) => apiClient.patch<unknown>(`/api/companies/${companyId}/goals/${id}`, data),
};
