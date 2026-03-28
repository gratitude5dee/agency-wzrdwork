/**
 * Protocol Labs Autonomous Loop — Safety Guardrails
 *
 * Transaction validation and failure-abort logic to ensure
 * agents operate within configured safety boundaries.
 */

import { logExecution } from "@/lib/erc8004/execution-log";
import { checkBudgetRemaining } from "./budget";
import type {
  TransactionParams,
  SpendLimits,
  ValidationResult,
  GuardrailCheckParams,
  GuardrailResult,
} from "./types";

/** Operations considered unsafe (e.g. draining wallet) */
const UNSAFE_OPERATIONS = [
  "drain_wallet",
  "transfer_all",
  "approve_unlimited",
  "self_destruct",
  "delegate_all",
];

/**
 * Validate a transaction against configured safety limits.
 *
 * Checks:
 * 1. Amount does not exceed the spend limit
 * 2. Recipient is in the whitelist (if whitelist is non-empty)
 * 3. Operation is not in the unsafe operations list
 *
 * @param params - Transaction parameters to validate
 * @param limits - Configured spending limits and whitelist
 * @returns Validation result with reason if invalid
 */
export function validateTransaction(
  params: TransactionParams,
  limits: SpendLimits,
): ValidationResult {
  // Check for unsafe operations
  if (UNSAFE_OPERATIONS.includes(params.operation.toLowerCase())) {
    return {
      valid: false,
      reason: `Unsafe operation blocked: ${params.operation}`,
    };
  }

  // Check amount within spend limit
  if (params.amount > limits.maxAmountUsd) {
    return {
      valid: false,
      reason: `Amount $${params.amount} exceeds spend limit of $${limits.maxAmountUsd}`,
    };
  }

  // Check amount is non-negative
  if (params.amount < 0) {
    return {
      valid: false,
      reason: "Transaction amount cannot be negative",
    };
  }

  // Check recipient whitelist (only if whitelist is non-empty)
  if (limits.recipientWhitelist.length > 0) {
    const normalizedRecipient = params.recipient.toLowerCase();
    const normalizedWhitelist = limits.recipientWhitelist.map((addr) =>
      addr.toLowerCase(),
    );

    if (!normalizedWhitelist.includes(normalizedRecipient)) {
      return {
        valid: false,
        reason: `Recipient ${params.recipient} is not in the whitelist`,
      };
    }
  }

  return { valid: true };
}

/**
 * Log a transaction validation result via the execution logging system.
 *
 * @param agentId - The agent performing the transaction
 * @param companyId - The company the agent belongs to
 * @param runId - The current run ID
 * @param params - Transaction parameters that were validated
 * @param result - The validation result
 */
export async function logValidation(
  agentId: string,
  companyId: string,
  runId: string | null,
  params: TransactionParams,
  result: ValidationResult,
): Promise<void> {
  await logExecution(agentId, companyId, runId, "safety_check", {
    action: "validate_transaction",
    params: {
      amount: params.amount,
      recipient: params.recipient,
      operation: params.operation,
    },
    result: {
      valid: result.valid,
      reason: result.reason ?? null,
    },
  });
}

/**
 * Check if the loop should abort due to repeated failures.
 *
 * @param retryCount - Current number of retries
 * @param maxRetries - Maximum allowed retries
 * @returns true if the loop should abort
 */
export function abortOnRepeatedFailure(
  retryCount: number,
  maxRetries: number,
): boolean {
  return retryCount >= maxRetries;
}

/**
 * Log an abort-on-failure event via the execution logging system.
 *
 * @param agentId - The agent that hit the retry limit
 * @param companyId - The company the agent belongs to
 * @param runId - The current run ID
 * @param retryCount - How many retries were attempted
 * @param maxRetries - The configured maximum
 * @param step - Which loop step failed
 */
export async function logAbort(
  agentId: string,
  companyId: string,
  runId: string | null,
  retryCount: number,
  maxRetries: number,
  step: string,
): Promise<void> {
  await logExecution(agentId, companyId, runId, "failure", {
    action: "abort_on_repeated_failure",
    step,
    retryCount,
    maxRetries,
    message: `Aborting after ${retryCount} retries (max: ${maxRetries}) on step: ${step}`,
  });
}

/* ================================================================
   Unified pre-action guardrail checkpoint
   ================================================================ */

/**
 * Run a unified guardrail checkpoint **before** an action executes.
 *
 * The checkpoint evaluates:
 * 1. Transaction safety (unsafe operations, negative amounts, recipient whitelist)
 * 2. Transaction amount vs spend limits
 * 3. Agent-level budget (historical spend + estimated cost vs configured max)
 *
 * The first rule violation short-circuits evaluation. The result is always
 * logged as a `safety_check` entry in `agent_execution_logs` so that
 * guardrail outcomes are observable in the log/response surface.
 *
 * @param params - Guardrail check parameters
 * @returns Structured result indicating whether the action is allowed
 */
export async function runGuardrailCheck(
  params: GuardrailCheckParams,
): Promise<GuardrailResult> {
  const { agentId, companyId, runId, transaction, spendLimits, estimatedCostUsd } = params;

  // ---- 1. Transaction safety checks (synchronous, no side effects) ----
  if (transaction) {
    const limits = spendLimits ?? { maxAmountUsd: Infinity, recipientWhitelist: [] };
    const txValidation = validateTransaction(transaction, limits);

    if (!txValidation.valid) {
      const result: GuardrailResult = {
        allowed: false,
        reason: txValidation.reason,
        ruleKind: deriveRuleKind(txValidation.reason),
      };

      await logGuardrailResult(agentId, companyId, runId, result, {
        transaction,
        spendLimits: limits,
        estimatedCostUsd,
      });

      return result;
    }
  }

  // ---- 2. Budget enforcement (async — reads historical spend) ----
  if (estimatedCostUsd !== undefined) {
    const budget = await checkBudgetRemaining(agentId);

    if (estimatedCostUsd > budget.remainingUsd) {
      const result: GuardrailResult = {
        allowed: false,
        reason: `Budget exceeded: estimated $${estimatedCostUsd} but only $${budget.remainingUsd.toFixed(2)} remaining (max: $${budget.maxBudgetUsd}, spent: $${budget.totalSpentUsd.toFixed(2)})`,
        ruleKind: "budget_exceeded",
        budgetSnapshot: budget,
      };

      await logGuardrailResult(agentId, companyId, runId, result, {
        estimatedCostUsd,
      });

      return result;
    }

    // Budget check passed — include snapshot for transparency
    const allowed: GuardrailResult = { allowed: true, budgetSnapshot: budget };

    await logGuardrailResult(agentId, companyId, runId, allowed, {
      transaction,
      spendLimits,
      estimatedCostUsd,
    });

    return allowed;
  }

  // ---- 3. All checks passed (no budget dimension requested) ----
  const passResult: GuardrailResult = { allowed: true };

  await logGuardrailResult(agentId, companyId, runId, passResult, {
    transaction,
    spendLimits,
    estimatedCostUsd,
  });

  return passResult;
}

/* ----------------------------------------------------------------
   Internal helpers
   ---------------------------------------------------------------- */

/**
 * Derive a machine-readable rule kind from a human-readable validation reason.
 */
function deriveRuleKind(
  reason: string | undefined,
): GuardrailResult["ruleKind"] {
  if (!reason) return "custom";
  const lower = reason.toLowerCase();
  if (lower.includes("unsafe operation")) return "unsafe_operation";
  if (lower.includes("exceeds spend limit")) return "budget_exceeded";
  if (lower.includes("not in the whitelist")) return "recipient_blocked";
  if (lower.includes("cannot be negative")) return "negative_amount";
  return "custom";
}

/**
 * Log the guardrail checkpoint result to execution logs.
 */
async function logGuardrailResult(
  agentId: string,
  companyId: string,
  runId: string | null,
  result: GuardrailResult,
  context: Record<string, unknown>,
): Promise<void> {
  await logExecution(agentId, companyId, runId, "safety_check", {
    action: "guardrail_check",
    allowed: result.allowed,
    reason: result.reason ?? null,
    ruleKind: result.ruleKind ?? null,
    budgetSnapshot: result.budgetSnapshot ?? null,
    context,
  });
}
