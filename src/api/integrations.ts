import { apiClient } from "./client";

export const integrationsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/integrations`),
  update: (companyId: string, id: string, data: unknown) =>
    apiClient.patch<unknown>(`/api/companies/${companyId}/integrations/${id}`, data),
};
