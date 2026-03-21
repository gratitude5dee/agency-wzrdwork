import { apiClient } from "./client";

export const agentsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/agents`),
  get: (companyId: string, agentId: string) => apiClient.get<unknown>(`/api/companies/${companyId}/agents/${agentId}`),
  create: (companyId: string, data: unknown) => apiClient.post<unknown>(`/api/companies/${companyId}/agents`, data),
  update: (companyId: string, agentId: string, data: unknown) => apiClient.patch<unknown>(`/api/companies/${companyId}/agents/${agentId}`, data),
  delete: (companyId: string, agentId: string) => apiClient.delete<void>(`/api/companies/${companyId}/agents/${agentId}`),
};
