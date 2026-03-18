/**
 * Protocol Labs Autonomous Loop — Budget Tracking
 *
 * Functions to track compute budget (tokens + cost) per agent run,
 * calculate remaining budget, and enforce budget limits.
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import type { BudgetData } from "./types";

/** Default maximum budget in USD if not configured */
const DEFAULT_MAX_BUDGET_USD = 10;

/**
 * Track budget usage for a specific run by updating the runs table
 * with token counts and cost data.
 *
 * @param runId - The run to update
 * @param tokensUsed - Object with input and output token counts
 * @param costUsd - The cost in USD for this usage
 */
export async function trackBudget(
  runId: string,
  tokensUsed: { input: number; output: number },
  costUsd: number,
): Promise<void> {
  // First, get the current run to add to existing totals
  const { data: currentRun, error: fetchError } = await supabase
    .from("runs")
    .select("total_input_tokens, total_output_tokens, total_cost_usd, agent_id, company_id")
    .eq("id", runId)
    .single();

  if (fetchError || !currentRun) {
    throw new Error(
      `Failed to fetch run ${runId}: ${fetchError?.message ?? "not found"}`,
    );
  }

  const newInputTokens =
    (currentRun.total_input_tokens ?? 0) + tokensUsed.input;
  const newOutputTokens =
    (currentRun.total_output_tokens ?? 0) + tokensUsed.output;
  const newCostUsd = (currentRun.total_cost_usd ?? 0) + costUsd;

  const { error: updateError } = await supabase
    .from("runs")
    .update({
      total_input_tokens: newInputTokens,
      total_output_tokens: newOutputTokens,
      total_cost_usd: newCostUsd,
    })
    .eq("id", runId);

  if (updateError) {
    throw new Error(
      `Failed to update run ${runId} budget: ${updateError.message}`,
    );
  }

  // Log the budget tracking operation
  await logExecution(
    currentRun.agent_id,
    currentRun.company_id,
    runId,
    "output",
    {
      action: "track_budget",
      tokensUsed,
      costUsd,
      totals: {
        input_tokens: newInputTokens,
        output_tokens: newOutputTokens,
        cost_usd: newCostUsd,
      },
    },
  );
}

/**
 * Check the remaining budget for an agent by summing historical run costs
 * and comparing to the configured maximum budget.
 *
 * The max budget is read from the agent's compute_constraints in the
 * agent_identities manifest, falling back to DEFAULT_MAX_BUDGET_USD.
 *
 * @param agentId - The agent to check budget for
 * @returns Budget data including spent, remaining, and max
 */
export async function checkBudgetRemaining(
  agentId: string,
): Promise<BudgetData> {
  // Sum all run costs for this agent
  const { data: runs, error: runsError } = await supabase
    .from("runs")
    .select("total_input_tokens, total_output_tokens, total_cost_usd")
    .eq("agent_id", agentId);

  if (runsError) {
    throw new Error(
      `Failed to fetch runs for agent ${agentId}: ${runsError.message}`,
    );
  }

  const totalInputTokens = (runs ?? []).reduce(
    (sum, r) => sum + (r.total_input_tokens ?? 0),
    0,
  );
  const totalOutputTokens = (runs ?? []).reduce(
    (sum, r) => sum + (r.total_output_tokens ?? 0),
    0,
  );
  const totalSpentUsd = (runs ?? []).reduce(
    (sum, r) => sum + (r.total_cost_usd ?? 0),
    0,
  );

  // Try to read max budget from agent identity manifest
  let maxBudgetUsd = DEFAULT_MAX_BUDGET_USD;
  const { data: identity } = await supabase
    .from("agent_identities")
    .select("manifest")
    .eq("agent_id", agentId)
    .single();

  if (identity?.manifest) {
    const manifest = identity.manifest as Record<string, unknown>;
    const constraints = manifest.compute_constraints as
      | Record<string, unknown>
      | undefined;
    if (constraints?.budget_usd && typeof constraints.budget_usd === "number") {
      maxBudgetUsd = constraints.budget_usd;
    }
  }

  return {
    totalSpentUsd,
    totalInputTokens,
    totalOutputTokens,
    maxBudgetUsd,
    remainingUsd: Math.max(0, maxBudgetUsd - totalSpentUsd),
  };
}

/**
 * Enforce budget limits before starting an operation.
 * Throws an error if the estimated cost would exceed the remaining budget.
 *
 * @param agentId - The agent to check
 * @param estimatedCost - The estimated cost of the next operation in USD
 * @throws Error if budget would be exceeded
 */
export async function enforceBudget(
  agentId: string,
  estimatedCost: number,
): Promise<void> {
  const budget = await checkBudgetRemaining(agentId);

  if (estimatedCost > budget.remainingUsd) {
    // Log the budget enforcement failure
    const { data: agent } = await supabase
      .from("agents")
      .select("company_id")
      .eq("id", agentId)
      .single();

    if (agent) {
      await logExecution(agentId, agent.company_id, null, "failure", {
        action: "enforce_budget",
        estimatedCost,
        remainingBudget: budget.remainingUsd,
        maxBudget: budget.maxBudgetUsd,
        totalSpent: budget.totalSpentUsd,
        message: `Budget exceeded: estimated $${estimatedCost} but only $${budget.remainingUsd} remaining (max: $${budget.maxBudgetUsd})`,
      });
    }

    throw new Error(
      `Budget exceeded for agent ${agentId}: estimated cost $${estimatedCost} exceeds remaining budget $${budget.remainingUsd} (max: $${budget.maxBudgetUsd}, spent: $${budget.totalSpentUsd})`,
    );
  }
}
