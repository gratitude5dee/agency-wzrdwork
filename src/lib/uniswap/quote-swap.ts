/**
 * Uniswap Quote & Swap Surface — Orchestrated Flow
 *
 * Provides a product- or agent-triggered Uniswap quote and swap path that:
 *   1. Loads persisted Uniswap configuration for the company
 *   2. Executes the approval→quote→swap pipeline
 *   3. Records quote and transaction/order evidence in the runtime trail
 *      (agent_execution_logs) for full observability
 *
 * The evidence trail uses shared identifiers (company_id, agent_id, run_id)
 * so validators can trace swap activity without hidden manual correlation.
 *
 * Fulfills: VAL-UNISWAP-001
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import { UniswapClient } from "./client";
import { swap as executeSwap } from "./swap";
import { loadUniswapConfig } from "./config";
import type { Json } from "@/integrations/supabase/types";
import type { ExecutionLogType } from "@/lib/erc8004/types";
import type {
  SupportedChainId,
  QuoteResponse,
  SwapResult,
} from "./types";

/* ================================================================
   Types
   ================================================================ */

/** Input for the Uniswap quote-and-swap flow */
export interface UniswapFlowInput {
  /** Company that owns this swap context */
  companyId: string;
  /** Agent triggering the swap (optional for product-triggered flows) */
  agentId?: string;
  /** Run to associate evidence with (optional) */
  runId?: string;
  /** Token address to send */
  tokenIn: string;
  /** Token address to receive */
  tokenOut: string;
  /** Amount in base units */
  amount: string;
  /** Wallet address that will sign and receive tokens */
  walletAddress: string;
  /** Chain ID override — if omitted, uses persisted config */
  chainId?: SupportedChainId;
  /** Permit2 signature for swap execution */
  signature?: string;
  /** Slippage tolerance (percentage, e.g. 0.5 for 0.5%) */
  slippageTolerance?: number;
}

/** Result of the quote-only flow */
export interface QuoteFlowResult {
  success: boolean;
  /** The raw quote response from Uniswap */
  quoteResponse: QuoteResponse | null;
  /** Whether a token approval is needed before swap */
  approvalNeeded: boolean;
  /** The approval transaction if needed */
  approvalTransaction: unknown | null;
  /** Chain ID used for the quote */
  chainId: SupportedChainId;
  /** Error message if the flow failed */
  error?: string;
  /** Log ID of the evidence entry */
  evidenceLogId?: string;
}

/** Result of the full swap flow (includes quote) */
export interface SwapFlowResult {
  success: boolean;
  /** The underlying SwapResult from the swap library */
  swapResult: SwapResult | null;
  /** Chain ID used */
  chainId: SupportedChainId;
  /** Transaction hash or order ID (when successful) */
  transactionHash: string | null;
  /** Routing type used */
  routing: string | null;
  /** Whether approval was needed */
  approvalNeeded: boolean;
  /** Error message if the flow failed */
  error?: string;
  /** Log ID of the evidence entry */
  evidenceLogId?: string;
}

/* ================================================================
   Evidence recording helpers
   ================================================================ */

/**
 * Record a Uniswap evidence entry in agent_execution_logs.
 *
 * When an agentId is available, uses the structured logExecution helper.
 * Otherwise, inserts directly for product-triggered (non-agent) flows.
 *
 * Returns the created log entry's ID for traceability.
 */
async function recordUniswapEvidence(
  companyId: string,
  agentId: string | undefined,
  runId: string | undefined,
  logType: ExecutionLogType,
  content: Record<string, unknown>,
): Promise<string | null> {
  try {
    if (agentId) {
      // Use the structured ERC-8004 logging for agent-triggered flows
      const logRow = await logExecution(
        agentId,
        companyId,
        runId ?? null,
        logType,
        content,
      );
      return logRow?.id ?? null;
    }

    // Product-triggered flow: insert directly with a sentinel agent_id
    // We still want the evidence in the log trail for the company
    const { data, error } = await supabase
      .from("agent_execution_logs")
      .insert({
        agent_id: agentId ?? "00000000-0000-0000-0000-000000000000",
        company_id: companyId,
        run_id: runId ?? null,
        log_type: logType,
        content: content as unknown as Json,
      })
      .select("id")
      .single();

    if (error || !data) return null;
    return data.id;
  } catch {
    // Evidence recording should not break the flow
    return null;
  }
}

/**
 * Record a Uniswap event as an activity_events entry for the company.
 */
async function recordActivityEvent(
  companyId: string,
  agentId: string | undefined,
  action: string,
  details: string,
): Promise<void> {
  await supabase.from("activity_events").insert({
    company_id: companyId,
    agent_id: agentId ?? null,
    action,
    details,
  });
}

/* ================================================================
   Quote Flow
   ================================================================ */

/**
 * Execute a Uniswap quote flow with evidence recording.
 *
 * 1. Loads the company's Uniswap config (or uses explicit chainId)
 * 2. Checks token approval status
 * 3. Fetches a quote
 * 4. Records the quote and approval-needed state as evidence
 *
 * @param input - The flow input parameters
 * @returns Quote result with evidence trail
 */
export async function executeQuoteFlow(
  input: UniswapFlowInput,
): Promise<QuoteFlowResult> {
  const { companyId, agentId, runId, tokenIn, tokenOut, amount, walletAddress } = input;

  // 1. Resolve chain ID from config or explicit override
  let chainId = input.chainId;
  if (!chainId) {
    const config = await loadUniswapConfig(companyId);
    if (!config.configured || !config.chainId) {
      const error = "Uniswap not configured: no chain selected for this company";
      await recordUniswapEvidence(companyId, agentId, runId, "failure", {
        action: "uniswap_quote_failed",
        error,
        integration: "uniswap",
      });
      return {
        success: false,
        quoteResponse: null,
        approvalNeeded: false,
        approvalTransaction: null,
        chainId: 1 as SupportedChainId,
        error,
      };
    }
    chainId = config.chainId;
  }

  const client = new UniswapClient();

  // 2. Check approval
  let approvalNeeded = false;
  let approvalTransaction: unknown = null;

  try {
    const approvalResult = await client.checkApproval(
      tokenIn,
      walletAddress,
      amount,
      chainId,
    );
    if (approvalResult.approval) {
      approvalNeeded = true;
      approvalTransaction = approvalResult.approval;
    }
  } catch (err) {
    const error = `Approval check failed: ${err instanceof Error ? err.message : String(err)}`;
    await recordUniswapEvidence(companyId, agentId, runId, "failure", {
      action: "uniswap_approval_check_failed",
      error,
      integration: "uniswap",
      chainId,
      tokenIn,
      tokenOut,
    });
    return {
      success: false,
      quoteResponse: null,
      approvalNeeded: false,
      approvalTransaction: null,
      chainId,
      error,
    };
  }

  // 3. Get quote
  let quoteResponse: QuoteResponse;
  try {
    quoteResponse = await client.getQuote(
      tokenIn,
      tokenOut,
      amount,
      chainId,
      walletAddress,
      {
        slippageTolerance: input.slippageTolerance,
      },
    );
  } catch (err) {
    const error = `Quote failed: ${err instanceof Error ? err.message : String(err)}`;
    await recordUniswapEvidence(companyId, agentId, runId, "failure", {
      action: "uniswap_quote_failed",
      error,
      integration: "uniswap",
      chainId,
      tokenIn,
      tokenOut,
      approvalNeeded,
    });
    return {
      success: false,
      quoteResponse: null,
      approvalNeeded,
      approvalTransaction,
      chainId,
      error,
    };
  }

  // 4. Record quote evidence
  const evidenceLogId = await recordUniswapEvidence(
    companyId,
    agentId,
    runId,
    "output",
    {
      action: "uniswap_quote",
      integration: "uniswap",
      chainId,
      tokenIn,
      tokenOut,
      amount,
      walletAddress,
      routing: quoteResponse.routing,
      quoteId: quoteResponse.requestId,
      approvalNeeded,
      quoteDetails: {
        routing: quoteResponse.routing,
        requestId: quoteResponse.requestId,
        hasPermitData: quoteResponse.permitData !== null,
      },
    },
  );

  await recordActivityEvent(
    companyId,
    agentId,
    "uniswap_quote",
    `Uniswap quote: ${tokenIn} → ${tokenOut} on chain ${chainId}${approvalNeeded ? " (approval needed)" : ""}`,
  );

  return {
    success: true,
    quoteResponse,
    approvalNeeded,
    approvalTransaction,
    chainId,
    evidenceLogId: evidenceLogId ?? undefined,
  };
}

/* ================================================================
   Swap Flow
   ================================================================ */

/**
 * Execute a full Uniswap swap flow with evidence recording.
 *
 * 1. Loads the company's Uniswap config (or uses explicit chainId)
 * 2. Runs the full approval→quote→swap pipeline
 * 3. Records transaction/order evidence in the runtime trail
 *
 * @param input - The flow input parameters
 * @returns Swap result with evidence trail
 */
export async function executeSwapFlow(
  input: UniswapFlowInput,
): Promise<SwapFlowResult> {
  const { companyId, agentId, runId, tokenIn, tokenOut, amount, walletAddress } = input;

  // 1. Resolve chain ID from config or explicit override
  let chainId = input.chainId;
  if (!chainId) {
    const config = await loadUniswapConfig(companyId);
    if (!config.configured || !config.chainId) {
      const error = "Uniswap not configured: no chain selected for this company";
      await recordUniswapEvidence(companyId, agentId, runId, "failure", {
        action: "uniswap_swap_failed",
        error,
        integration: "uniswap",
      });
      return {
        success: false,
        swapResult: null,
        chainId: 1 as SupportedChainId,
        transactionHash: null,
        routing: null,
        approvalNeeded: false,
        error,
      };
    }
    chainId = config.chainId;
  }

  // 2. Execute full swap pipeline
  const client = new UniswapClient();
  let swapResult: SwapResult;

  try {
    swapResult = await executeSwap(
      tokenIn,
      tokenOut,
      amount,
      chainId,
      walletAddress,
      {
        signature: input.signature,
        slippageTolerance: input.slippageTolerance,
        client,
      },
    );
  } catch (err) {
    const error = `Swap pipeline failed: ${err instanceof Error ? err.message : String(err)}`;
    await recordUniswapEvidence(companyId, agentId, runId, "failure", {
      action: "uniswap_swap_failed",
      error,
      integration: "uniswap",
      chainId,
      tokenIn,
      tokenOut,
    });
    return {
      success: false,
      swapResult: null,
      chainId,
      transactionHash: null,
      routing: null,
      approvalNeeded: false,
      error,
    };
  }

  // 3. Record evidence based on outcome
  const evidenceContent: Record<string, unknown> = {
    action: swapResult.success ? "uniswap_swap" : "uniswap_swap_failed",
    integration: "uniswap",
    chainId,
    tokenIn,
    tokenOut,
    amount,
    walletAddress,
    routing: swapResult.routing,
    success: swapResult.success,
    approvalNeeded: swapResult.approvalNeeded,
    transactionHash: swapResult.transactionHash,
  };

  if (swapResult.error) {
    evidenceContent.error = swapResult.error;
  }

  if (swapResult.quoteResponse) {
    evidenceContent.quoteId = swapResult.quoteResponse.requestId;
  }

  if (swapResult.approvalNeeded && swapResult.approvalTransaction) {
    evidenceContent.approvalTransaction = {
      to: swapResult.approvalTransaction.to,
      from: swapResult.approvalTransaction.from,
      chainId: swapResult.approvalTransaction.chainId,
    };
  }

  const logType = swapResult.success ? "output" : "failure";
  const evidenceLogId = await recordUniswapEvidence(
    companyId,
    agentId,
    runId,
    logType,
    evidenceContent,
  );

  // 4. Activity event
  const activityAction = swapResult.success ? "uniswap_swap" : "uniswap_swap_failed";
  const activityDetails = swapResult.success
    ? `Uniswap swap: ${tokenIn} → ${tokenOut} on chain ${chainId} (${swapResult.routing}, tx: ${swapResult.transactionHash})`
    : `Uniswap swap failed: ${tokenIn} → ${tokenOut} on chain ${chainId} — ${swapResult.error ?? "unknown error"}`;

  await recordActivityEvent(companyId, agentId, activityAction, activityDetails);

  return {
    success: swapResult.success,
    swapResult,
    chainId,
    transactionHash: swapResult.transactionHash,
    routing: swapResult.routing,
    approvalNeeded: swapResult.approvalNeeded,
    error: swapResult.error,
    evidenceLogId: evidenceLogId ?? undefined,
  };
}
