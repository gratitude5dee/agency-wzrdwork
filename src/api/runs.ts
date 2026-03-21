import { apiClient } from "./client";

export const runsApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/runs`),
  get: (companyId: string, id: string) => apiClient.get<unknown>(`/api/companies/${companyId}/runs/${id}`),
};
