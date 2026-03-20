/**
 * ERC-8004 Agent Identity Types
 *
 * Defines the TypeScript types for agent manifests (agent.json)
 * and execution log entries per the ERC-8004 specification.
 */

/** Compute resource constraints for an agent */
export interface ComputeConstraints {
  max_iterations: number;
  max_tokens_per_run: number;
  budget_usd: number;
}

/**
 * Agent manifest following the ERC-8004 agent.json schema.
 * This is stored as JSONB in the agent_identities table.
 */
export interface AgentManifest {
  name: string;
  operator_wallet: string;
  erc8004_identity: string;
  supported_tools: string[];
  tech_stacks: string[];
  compute_constraints: ComputeConstraints;
  task_categories: string[];
}

/** Allowed log types for execution log entries */
export type ExecutionLogType =
  | "decision"
  | "tool_call"
  | "retry"
  | "failure"
  | "output"
  | "safety_check";

/** A single entry in the agent_execution_logs table */
export interface ExecutionLogEntry {
  id: string;
  company_id: string;
  agent_id: string;
  run_id: string | null;
  log_type: ExecutionLogType;
  content: Record<string, unknown>;
  created_at: string;
}
