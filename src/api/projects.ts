import { apiClient } from "./client";

export const projectsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/projects`),
  get: (companyId: string, id: string) => apiClient.get<unknown>(`/api/companies/${companyId}/projects/${id}`),
  create: (companyId: string, data: unknown) => apiClient.post<unknown>(`/api/companies/${companyId}/projects`, data),
  update: (companyId: string, id: string, data: unknown) => apiClient.patch<unknown>(`/api/companies/${companyId}/projects/${id}`, data),
};
