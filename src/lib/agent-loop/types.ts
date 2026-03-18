/**
 * Protocol Labs Autonomous Execution Loop — Types
 *
 * Types for the "Let the Agent Cook" track autonomous loop,
 * safety guardrails, and budget tracking.
 */

/** Steps in the autonomous execution loop */
export type LoopStep = "discover" | "plan" | "execute" | "verify" | "submit";

/** Status of a single subtask within the loop */
export type SubtaskStatus = "pending" | "running" | "completed" | "failed";

/** A subtask produced during the plan step */
export interface Subtask {
  id: string;
  description: string;
  status: SubtaskStatus;
  result?: unknown;
  error?: string;
}

/**
 * Authority policy governing whether the loop can auto-submit
 * or must pause for operator approval before completing.
 *
 * - "auto"     — submit completes without operator approval
 * - "approval" — submit pauses and creates an approval record; the
 *                run stays in "approval_pending" until resolved externally
 */
export type AuthorityPolicy = "auto" | "approval";

/** Options for configuring the autonomous loop */
export interface LoopOptions {
  /** Maximum number of retry attempts per step (default: 3) */
  maxRetries?: number;
  /** Spend limit in USD for the entire run */
  spendLimitUsd?: number;
  /** Whitelisted recipient addresses for transactions */
  recipientWhitelist?: string[];
  /** Maximum token budget for the run */
  maxTokens?: number;
  /** Company ID for logging */
  companyId: string;
  /**
   * Optional issue ID that triggered this loop execution.
   * When provided, the run is linked to the issue and issue status
   * is updated as the loop progresses.
   */
  issueId?: string;
  /**
   * Authority policy for the submit step. Defaults to "auto".
   * When "approval", the submit step pauses and creates an approval
   * record instead of completing the run.
   */
  authorityPolicy?: AuthorityPolicy;
}

/** Result of a single loop step */
export interface StepResult {
  step: LoopStep;
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Final result of the autonomous loop */
export interface LoopResult {
  runId: string;
  agentId: string;
  task: string;
  steps: StepResult[];
  success: boolean;
  totalTokensUsed: number;
  totalCostUsd: number;
  /** The issue ID linked to this run, if any */
  issueId?: string;
  /**
   * When the authority policy is "approval", the run pauses at submit
   * and this field holds the created approval record ID.
   */
  approvalId?: string;
  /**
   * Terminal status of the run. "completed" for auto policy success,
   * "approval_pending" when paused for approval, "failed" on error.
   */
  runStatus: "completed" | "approval_pending" | "failed";
}

/** Transaction parameters for guardrail validation */
export interface TransactionParams {
  /** Amount in USD */
  amount: number;
  /** Recipient wallet address */
  recipient: string;
  /** Description of the operation */
  operation: string;
}

/** Spending limits for guardrail validation */
export interface SpendLimits {
  /** Maximum amount per transaction in USD */
  maxAmountUsd: number;
  /** Whitelisted recipient addresses */
  recipientWhitelist: string[];
}

/** Result of transaction validation */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Budget tracking data */
export interface BudgetData {
  totalSpentUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  maxBudgetUsd: number;
  remainingUsd: number;
}
