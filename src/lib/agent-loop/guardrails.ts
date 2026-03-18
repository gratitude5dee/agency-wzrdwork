/**
 * Protocol Labs Autonomous Loop — Safety Guardrails
 *
 * Transaction validation and failure-abort logic to ensure
 * agents operate within configured safety boundaries.
 */

import { logExecution } from "@/lib/erc8004/execution-log";
import type { TransactionParams, SpendLimits, ValidationResult } from "./types";

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
