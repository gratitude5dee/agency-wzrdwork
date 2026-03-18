/**
 * Celo Payment Flow — Orchestrated Flow
 *
 * Provides a product- or agent-triggered Celo payment/treasury path that:
 *   1. Loads persisted Celo configuration for the company
 *   2. Demonstrates a Celo stablecoin payment or treasury transfer
 *   3. Records chain configuration, payment details, and finance evidence
 *      in the runtime trail (agent_execution_logs) for full observability
 *
 * The evidence trail uses shared identifiers (company_id, agent_id, run_id)
 * so validators can trace Celo activity without hidden manual correlation.
 *
 * Fulfills: VAL-CELO-001
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import { loadCeloConfig } from "./integration-config";
import {
  CELO_CHAIN_CONFIG,
  CUSD_TOKEN_ADDRESS,
  CEUR_TOKEN_ADDRESS,
  cusdToSmallestUnit,
} from "./config";
import type { Json } from "@/integrations/supabase/types";
import type { ExecutionLogType } from "@/lib/erc8004/types";
import type { CeloStablecoin } from "./integration-config";

/* ================================================================
   Types
   ================================================================ */

/** Input for the Celo payment flow */
export interface CeloPaymentInput {
  /** Company that owns this payment context */
  companyId: string;
  /** Agent triggering the payment (optional for product-triggered flows) */
  agentId?: string;
  /** Run to associate evidence with (optional) */
  runId?: string;
  /** Recipient wallet address */
  recipientAddress: string;
  /** Payment amount in human-readable units (e.g. 1.5 for 1.5 cUSD) */
  amount: number;
  /** Stablecoin to use — if omitted, uses persisted config preference */
  stablecoin?: CeloStablecoin;
  /** Sender wallet address (treasury or company wallet) */
  senderAddress?: string;
  /** Optional memo or reference for the payment */
  memo?: string;
}

/** Result of the Celo payment flow */
export interface CeloPaymentResult {
  /** Whether the payment flow succeeded */
  success: boolean;
  /** Network used */
  network: string | null;
  /** Token used for payment */
  stablecoin: CeloStablecoin | null;
  /** Token contract address used */
  tokenAddress: string | null;
  /** Amount in smallest units */
  amountSmallestUnit: string | null;
  /** Amount in human-readable units */
  amountHuman: number | null;
  /** Sender address */
  senderAddress: string | null;
  /** Recipient address */
  recipientAddress: string | null;
  /** Chain ID used */
  chainId: number | null;
  /** Transaction hash (when fully executed) */
  transactionHash: string | null;
  /** Whether the payment needs wallet approval */
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
 * Record a Celo evidence entry in agent_execution_logs.
 *
 * When an agentId is available, uses the structured logExecution helper.
 * Otherwise, inserts directly for product-triggered (non-agent) flows.
 */
async function recordCeloEvidence(
  companyId: string,
  agentId: string | undefined,
  runId: string | undefined,
  logType: ExecutionLogType,
  content: Record<string, unknown>,
): Promise<string | null> {
  try {
    if (agentId) {
      const logRow = await logExecution(
        agentId,
        companyId,
        runId ?? null,
        logType,
        content,
      );
      return logRow?.id ?? null;
    }

    // Product-triggered flow: insert directly with sentinel agent_id
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
 * Record a Celo event as an activity_events entry for the company.
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
   Resolve stablecoin details
   ================================================================ */

function resolveStablecoinAddress(stablecoin: CeloStablecoin): string {
  return stablecoin === "cUSD"
    ? CUSD_TOKEN_ADDRESS
    : CEUR_TOKEN_ADDRESS;
}

/* ================================================================
   Payment Flow
   ================================================================ */

/**
 * Execute a Celo stablecoin payment flow with finance evidence recording.
 *
 * 1. Loads the company's Celo config (or uses explicit overrides)
 * 2. Resolves the stablecoin token and builds the payment transaction
 * 3. Records chain configuration, payment, and finance trace as evidence
 *
 * The flow prepares and records a Celo stablecoin transfer. The actual
 * on-chain submission requires wallet signing, which the product surface
 * handles. This function builds the transaction data and records evidence.
 *
 * @param input - The flow input parameters
 * @returns Payment result with finance trail
 */
export async function executeCeloPayment(
  input: CeloPaymentInput,
): Promise<CeloPaymentResult> {
  const { companyId, agentId, runId, recipientAddress, amount } = input;

  // 1. Resolve Celo config
  const config = await loadCeloConfig(companyId);
  if (!config.configured || !config.network) {
    const error = "Celo not configured: no network selected for this company";
    await recordCeloEvidence(companyId, agentId, runId, "failure", {
      action: "celo_payment_failed",
      error,
      integration: "celo",
    });
    return {
      success: false,
      network: null,
      stablecoin: null,
      tokenAddress: null,
      amountSmallestUnit: null,
      amountHuman: null,
      senderAddress: null,
      recipientAddress: null,
      chainId: null,
      transactionHash: null,
      approvalNeeded: false,
      error,
    };
  }

  // 2. Resolve stablecoin and sender
  const stablecoin: CeloStablecoin =
    input.stablecoin ?? config.preferredStablecoin ?? "cUSD";
  const tokenAddress = resolveStablecoinAddress(stablecoin);
  const senderAddress = input.senderAddress ?? config.treasuryAddress;

  if (!senderAddress) {
    const error = "Celo payment failed: no sender/treasury address configured";
    await recordCeloEvidence(companyId, agentId, runId, "failure", {
      action: "celo_payment_failed",
      error,
      integration: "celo",
      network: config.network,
    });
    return {
      success: false,
      network: config.network,
      stablecoin,
      tokenAddress,
      amountSmallestUnit: null,
      amountHuman: amount,
      senderAddress: null,
      recipientAddress,
      chainId: CELO_CHAIN_CONFIG.chainId,
      transactionHash: null,
      approvalNeeded: false,
      error,
    };
  }

  // 3. Build payment details
  const amountSmallestUnit = cusdToSmallestUnit(amount);
  const chainId = CELO_CHAIN_CONFIG.chainId;

  // 4. Record payment evidence (transaction prepared and ready for signing)
  // In a full implementation, the wallet-signing step would add the tx hash.
  // For the proof surface, we record the prepared transaction data.
  const evidenceContent: Record<string, unknown> = {
    action: "celo_payment",
    integration: "celo",
    network: config.network,
    chainId,
    stablecoin,
    tokenAddress,
    amountHuman: amount,
    amountSmallestUnit,
    senderAddress,
    recipientAddress,
    memo: input.memo ?? null,
    chainConfig: {
      name: CELO_CHAIN_CONFIG.name,
      rpcUrl: CELO_CHAIN_CONFIG.rpcUrl,
      explorerUrl: CELO_CHAIN_CONFIG.explorerUrl,
      nativeCurrency: CELO_CHAIN_CONFIG.nativeCurrency.symbol,
    },
    // The payment is prepared; wallet signing produces the tx hash
    approvalNeeded: true,
    status: "prepared",
  };

  const evidenceLogId = await recordCeloEvidence(
    companyId,
    agentId,
    runId,
    "output",
    evidenceContent,
  );

  await recordActivityEvent(
    companyId,
    agentId,
    "celo_payment",
    `Celo payment: ${amount} ${stablecoin} from ${senderAddress} to ${recipientAddress} on ${config.network} (chain ${chainId})`,
  );

  return {
    success: true,
    network: config.network,
    stablecoin,
    tokenAddress,
    amountSmallestUnit,
    amountHuman: amount,
    senderAddress,
    recipientAddress,
    chainId,
    transactionHash: null, // Set after wallet signing
    approvalNeeded: true,
    evidenceLogId: evidenceLogId ?? undefined,
  };
}
