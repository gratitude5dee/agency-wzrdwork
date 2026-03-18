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
   * "approval_pending" when paused for approval, "failed" on error,
   * "guardrail_rejected" when stopped by a budget/safety guardrail.
   */
  runStatus: "completed" | "approval_pending" | "failed" | "guardrail_rejected";
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

/* ================================================================
   Guardrail checkpoint types
   ================================================================ */

/**
 * Rule kind that was violated, allowing callers to distinguish
 * between budget, safety, and other guardrail categories.
 */
export type GuardrailRuleKind =
  | "budget_exceeded"
  | "unsafe_operation"
  | "recipient_blocked"
  | "negative_amount"
  | "custom";

/**
 * Structured result from a pre-action guardrail checkpoint.
 *
 * When `allowed` is false, `reason` contains a human-readable
 * explanation naming the violated rule or limit source, and `ruleKind`
 * categorises the failure for programmatic handling.
 */
export interface GuardrailResult {
  /** Whether the action is permitted */
  allowed: boolean;
  /** Human-readable reason when the action is blocked */
  reason?: string;
  /** Category of the guardrail rule that was violated */
  ruleKind?: GuardrailRuleKind;
  /** Budget snapshot at the time of the check (present when budget was evaluated) */
  budgetSnapshot?: BudgetData;
}

/**
 * Parameters for the unified guardrail checkpoint.
 *
 * Callers provide budget context (agentId + estimated cost) and/or
 * a transaction to validate. The checkpoint evaluates every supplied
 * dimension and returns the first failure it encounters.
 */
export interface GuardrailCheckParams {
  /** Agent ID for budget lookup */
  agentId: string;
  /** Company ID for logging */
  companyId: string;
  /** Current run ID for logging (null if check is pre-run) */
  runId: string | null;
  /** Estimated cost of the next action in USD (triggers budget check) */
  estimatedCostUsd?: number;
  /** Transaction to validate against safety rules */
  transaction?: TransactionParams;
  /** Spend limits for transaction validation (when transaction is provided) */
  spendLimits?: SpendLimits;
}
