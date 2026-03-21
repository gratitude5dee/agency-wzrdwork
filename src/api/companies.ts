import { apiClient } from "./client";

export const companiesApi = {
  list: () => apiClient.get<unknown[]>("/api/companies"),
  get: (id: string) => apiClient.get<unknown>(`/api/companies/${id}`),
  create: (data: unknown) => apiClient.post<unknown>("/api/companies", data),
  update: (id: string, data: unknown) => apiClient.patch<unknown>(`/api/companies/${id}`, data),
};
