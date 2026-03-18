/**
 * ERC-8004 Execution Logging System
 *
 * Structured logging for agent operations. Creates entries in the
 * agent_execution_logs Supabase table and supports export in the
 * Protocol Labs agent_log.json format.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import type { ExecutionLogType } from "./types";

type ExecutionLogRow = Database["public"]["Tables"]["agent_execution_logs"]["Row"];

/** Options for filtering execution logs */
export interface GetExecutionLogsOptions {
  runId?: string;
  logType?: ExecutionLogType;
}

/** Protocol Labs agent_log.json export entry (agent-global) */
export interface AgentLogEntry {
  timestamp: string;
  type: string;
  content: Record<string, unknown>;
  agent_id: string;
  run_id: string | null;
}

/** Protocol Labs agent_log.json export format (agent-global) */
export interface AgentLogExport {
  entries: AgentLogEntry[];
}

/** Run-scoped Protocol Labs agent_log.json export entry */
export interface RunLogEntry {
  log_id: string;
  timestamp: string;
  type: string;
  content: Record<string, unknown>;
  agent_id: string;
  run_id: string;
}

/** Token/cost usage summary for a run */
export interface RunUsage {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
}

/** Run-scoped Protocol Labs agent_log.json export envelope */
export interface RunLogExport {
  run_id: string;
  agent_id: string;
  company_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  summary: string | null;
  usage: RunUsage;
  entries: RunLogEntry[];
}

/**
 * Create an execution log entry in the agent_execution_logs table.
 *
 * @param agentId - The agent's UUID
 * @param companyId - The company's UUID
 * @param runId - Optional run UUID this log belongs to
 * @param logType - One of: decision, tool_call, retry, failure, output, safety_check
 * @param content - JSONB content varying by log type
 * @returns The newly created execution log row
 */
export async function logExecution(
  agentId: string,
  companyId: string,
  runId: string | null,
  logType: ExecutionLogType,
  content: Record<string, unknown>,
): Promise<ExecutionLogRow> {
  const { data, error } = await supabase
    .from("agent_execution_logs")
    .insert({
      agent_id: agentId,
      company_id: companyId,
      run_id: runId,
      log_type: logType,
      content: content as unknown as Json,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create execution log for agent ${agentId}: ${error?.message ?? "unknown error"}`,
    );
  }

  return data as ExecutionLogRow;
}

/**
 * Query execution logs for an agent with optional filtering.
 *
 * @param agentId - The agent's UUID
 * @param options - Optional filters: runId, logType
 * @returns Array of execution log rows ordered by created_at descending
 */
export async function getExecutionLogs(
  agentId: string,
  options?: GetExecutionLogsOptions,
): Promise<ExecutionLogRow[]> {
  let query = supabase
    .from("agent_execution_logs")
    .select("*")
    .eq("agent_id", agentId);

  if (options?.runId) {
    query = query.eq("run_id", options.runId);
  }

  if (options?.logType) {
    query = query.eq("log_type", options.logType);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Failed to fetch execution logs for agent ${agentId}: ${error.message}`,
    );
  }

  return (data ?? []) as ExecutionLogRow[];
}

/**
 * Export all execution logs for an agent in Protocol Labs agent_log.json format.
 *
 * Format: { entries: [{ timestamp, type, content, agent_id, run_id }] }
 *
 * @param agentId - The agent's UUID
 * @returns The exported log in agent_log.json format
 */
export async function exportAgentLog(agentId: string): Promise<AgentLogExport> {
  const logs = await getExecutionLogs(agentId);

  const entries: AgentLogEntry[] = logs.map((log) => ({
    timestamp: log.created_at,
    type: log.log_type,
    content: (log.content ?? {}) as Record<string, unknown>,
    agent_id: log.agent_id,
    run_id: log.run_id,
  }));

  return { entries };
}

/**
 * Export execution logs for a specific run in the Protocol Labs agent_log.json
 * envelope format. The envelope includes run metadata (status, timing, usage)
 * and each entry includes a `log_id` that maps back to the persisted
 * `agent_execution_logs` row for traceability.
 *
 * This is the primary artifact surface for VAL-ID-003 / VAL-PROTOCOL-002.
 *
 * @param runId - The run's UUID
 * @returns The run-scoped agent_log.json export
 */
export async function exportRunLog(runId: string): Promise<RunLogExport> {
  // 1. Fetch the run record for metadata
  const { data: run, error: runError } = await supabase
    .from("runs")
    .select("*")
    .eq("id", runId)
    .single();

  if (runError || !run) {
    throw new Error(
      `Failed to fetch run ${runId}: ${runError?.message ?? "not found"}`,
    );
  }

  // 2. Fetch all execution log rows scoped to this run
  const { data: logs, error: logsError } = await supabase
    .from("agent_execution_logs")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (logsError) {
    throw new Error(
      `Failed to fetch execution logs for run ${runId}: ${logsError.message}`,
    );
  }

  // 3. Map to Protocol Labs entry format with traceability
  const entries: RunLogEntry[] = (logs ?? []).map((log) => ({
    log_id: log.id,
    timestamp: log.created_at,
    type: log.log_type,
    content: (log.content ?? {}) as Record<string, unknown>,
    agent_id: log.agent_id,
    run_id: runId,
  }));

  // 4. Build the envelope
  return {
    run_id: run.id,
    agent_id: run.agent_id,
    company_id: run.company_id,
    status: run.status,
    started_at: run.created_at,
    finished_at: run.finished_at,
    summary: run.summary,
    usage: {
      total_input_tokens: run.total_input_tokens ?? 0,
      total_output_tokens: run.total_output_tokens ?? 0,
      total_cost_usd: run.total_cost_usd ?? 0,
    },
    entries,
  };
}
