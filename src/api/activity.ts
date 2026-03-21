import { apiClient } from "./client";

export const activityApi = {
  list: (companyId: string) => apiClient.get<unknown[]>(`/api/companies/${companyId}/activity`),
};
