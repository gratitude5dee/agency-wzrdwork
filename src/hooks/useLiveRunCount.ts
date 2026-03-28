import { useRunMetrics } from "./useDashboardMetrics";

export function useLiveRunCount() {
  const metrics = useRunMetrics();
  return {
    ...metrics,
    data: metrics.data?.live ?? 0,
  };
}
