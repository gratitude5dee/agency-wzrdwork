/**
 * React Query hook for reading agent execution logs.
 *
 * Provides paginated log reading with optional filtering by run and log type.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import type { Database } from "@/integrations/supabase/types";
import type { ExecutionLogType } from "@/lib/erc8004/types";

type ExecutionLogRow = Database["public"]["Tables"]["agent_execution_logs"]["Row"];

/** Options for the useExecutionLogs hook */
export interface UseExecutionLogsOptions {
  runId?: string;
  logType?: ExecutionLogType;
  page?: number;
  pageSize?: number;
}

/** Paginated result for execution logs */
export interface ExecutionLogsPage {
  logs: ExecutionLogRow[];
  total: number;
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * Hook for reading execution logs with pagination and filtering.
 *
 * @param agentId - The agent's UUID (undefined disables the query)
 * @param options - Optional filters and pagination
 */
export function useExecutionLogs(
  agentId: string | undefined,
  options?: UseExecutionLogsOptions,
) {
  const page = options?.page ?? 0;
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;

  return useQuery<ExecutionLogsPage>({
    queryKey: [
      "execution-logs",
      agentId,
      options?.runId,
      options?.logType,
      page,
      pageSize,
    ],
    queryFn: async () => {
      if (!agentId) {
        return { logs: [], total: 0, page, pageSize };
      }

      let query = supabase
        .from("agent_execution_logs")
        .select("*", { count: "exact" })
        .eq("agent_id", agentId);

      if (options?.runId) {
        query = query.eq("run_id", options.runId);
      }

      if (options?.logType) {
        query = query.eq("log_type", options.logType);
      }

      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        logs: (data ?? []) as ExecutionLogRow[],
        total: count ?? 0,
        page,
        pageSize,
      };
    },
    enabled: !!agentId,
  });
}

/**
 * Mutation hook for creating an execution log entry.
 * Invalidates the execution-logs query cache on success.
 */
export function useLogExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      companyId,
      runId,
      logType,
      content,
    }: {
      agentId: string;
      companyId: string;
      runId: string | null;
      logType: ExecutionLogType;
      content: Record<string, unknown>;
    }) => {
      return logExecution(agentId, companyId, runId, logType, content);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["execution-logs", variables.agentId],
      });
    },
  });
}
