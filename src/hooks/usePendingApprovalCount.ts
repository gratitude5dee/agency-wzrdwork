import { useApprovalMetrics } from "./useDashboardMetrics";

export function usePendingApprovalCount() {
  return useApprovalMetrics();
}
