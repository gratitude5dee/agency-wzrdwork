/**
 * ERC-8004 Manifest Builder
 *
 * Generates an agent.json manifest from agent data and operator wallet.
 */

import type { AgentManifest } from "./types";
import type { Database } from "@/integrations/supabase/types";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];

/** Default supported tools based on the adapter type */
const ADAPTER_TOOLS: Record<string, string[]> = {
  claude_local: ["code_generation", "code_review", "file_editing", "terminal"],
  codex_local: ["code_generation", "file_editing", "terminal"],
  cursor: ["code_generation", "code_review", "file_editing", "search"],
  gemini_local: ["code_generation", "research", "analysis"],
  opencode_local: ["code_generation", "file_editing", "terminal"],
  pi_local: ["conversation", "reasoning", "analysis"],
  openclaw_gateway: ["legal_analysis", "contract_review", "document_generation"],
  process: ["task_execution", "workflow_automation"],
  http: ["api_calls", "webhook_handling", "data_fetching"],
  hermes: ["web", "terminal", "file", "browser", "research", "code", "delegate"],
};

/** Map agent role to default task categories */
const ROLE_CATEGORIES: Record<string, string[]> = {
  ceo: ["strategy", "coordination", "delegation", "oversight"],
  cto: ["architecture", "technical_review", "infrastructure"],
  coo: ["operations", "process_management", "resource_allocation"],
  manager: ["coordination", "task_assignment", "reporting"],
  engineer: ["code_generation", "debugging", "code_review", "testing"],
  founding_engineer: ["code_generation", "architecture", "debugging", "code_review"],
  analyst: ["data_analysis", "reporting", "research"],
  designer: ["ui_design", "prototyping", "user_research"],
  researcher: ["research", "analysis", "documentation"],
  ops: ["deployment", "monitoring", "infrastructure"],
  support: ["issue_triage", "documentation", "user_assistance"],
  custom: ["general"],
};

/**
 * Build an ERC-8004 agent.json manifest from agent data and operator wallet.
 *
 * @param agent - The agent row from Supabase (or a partial with required fields)
 * @param operatorWallet - The operator's wallet address
 * @returns A fully populated AgentManifest
 */
export function buildManifest(
  agent: Pick<AgentRow, "id" | "name" | "role" | "adapter_type">,
  operatorWallet: string,
): AgentManifest {
  const supportedTools = ADAPTER_TOOLS[agent.adapter_type] ?? ["general"];
  const taskCategories = ROLE_CATEGORIES[agent.role] ?? ["general"];

  return {
    name: agent.name,
    operator_wallet: operatorWallet,
    erc8004_identity: `erc8004:${agent.id}`,
    supported_tools: supportedTools,
    tech_stacks: ["typescript", "react", "supabase", "vite"],
    compute_constraints: {
      max_iterations: 100,
      max_tokens_per_run: 200_000,
      budget_usd: 10,
    },
    task_categories: taskCategories,
  };
}
