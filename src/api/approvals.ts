import { apiClient } from "./client";

export const approvalsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/approvals`),
  get: (companyId: string, id: string) => apiClient.get<unknown>(`/api/companies/${companyId}/approvals/${id}`),
  resolve: (companyId: string, id: string, data: { status: string; note?: string }) =>
    apiClient.patch<unknown>(`/api/companies/${companyId}/approvals/${id}`, data),
};
