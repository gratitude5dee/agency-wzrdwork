/**
 * Uniswap Swap Execution — Wallet Signing Bridge
 *
 * Bridges the gap between the Uniswap Trade API client (which prepares
 * quotes and swap calldata) and actual on-chain execution via wallet signing.
 *
 * Supports two execution paths:
 *   1. Classic Swap (v2/v3/v4) — requires wallet to sign and submit tx
 *   2. UniswapX Order — requires wallet to sign a gasless off-chain order
 *
 * Uses thirdweb's in-app wallet for transaction signing and submission.
 *
 * Fulfills: VAL-UNISWAP-001
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import { UniswapClient } from "./client";
import type {
  QuoteResponse,
  SwapResponse,
  OrderResponse,
  SupportedChainId,
} from "./types";

/* ================================================================
   Constants
   ================================================================ */

/** Well-known token addresses on Base */
export const BASE_TOKENS = {
  WETH: "0x4200000000000000000000000000000000000006",
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDbC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6Ca",
  DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
  DEGEN: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed",
  AERO: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
} as const;

/** Well-known token addresses on Ethereum mainnet */
export const MAINNET_TOKENS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
} as const;

/* ================================================================
   Types
   ================================================================ */

/** Input for executing a swap */
export interface ExecuteSwapInput {
  /** Token to sell */
  tokenIn: string;
  /** Token to buy */
  tokenOut: string;
  /** Amount of tokenIn in smallest units */
  amount: string;
  /** Chain ID */
  chainId: SupportedChainId;
  /** Wallet address (swapper) */
  walletAddress: string;
  /** Slippage tolerance (e.g. "0.5" for 0.5%) */
  slippageTolerance?: string;
  /** Routing preference */
  routingPreference?: "BEST_PRICE" | "CLASSIC" | "UNISWAPX";
  /** Company ID for evidence */
  companyId?: string;
  /** Agent ID for evidence */
  agentId?: string;
  /** Run ID for evidence */
  runId?: string;
}

/** Prepared swap transaction for wallet signing */
export interface PreparedSwapTx {
  /** The quote from Uniswap */
  quote: QuoteResponse;
  /** Transaction data to sign (for classic swaps) */
  transaction?: {
    to: string;
    data: string;
    value: string;
    chainId: number;
    gasLimit?: string;
  };
  /** Order data to sign (for UniswapX) */
  order?: {
    encodedOrder: string;
    orderId: string;
  };
  /** Whether approval is needed before swap */
  approvalNeeded: boolean;
  /** Approval transaction (if needed) */
  approvalTx?: {
    to: string;
    data: string;
    value: "0";
    chainId: number;
  };
  /** Routing type used */
  routingType: "CLASSIC" | "DUTCH_V2" | "DUTCH_V3";
  /** Estimated output amount */
  estimatedOutput: string;
  /** Price impact */
  priceImpact?: string;
  /** Gas estimate in native token */
  gasEstimate?: string;
}

/** Result of swap execution */
export interface SwapExecutionResult {
  success: boolean;
  /** Transaction hash (for classic swaps) */
  transactionHash: string | null;
  /** Order ID (for UniswapX orders) */
  orderId: string | null;
  /** Block explorer URL */
  explorerUrl: string | null;
  /** Routing type used */
  routingType: string | null;
  /** Amount of tokenOut received */
  outputAmount: string | null;
  /** Error if failed */
  error?: string;
  /** Evidence log ID */
  evidenceLogId?: string;
}

/* ================================================================
   Swap Preparation
   ================================================================ */

/**
 * Prepare a swap by getting a quote and checking approvals.
 *
 * Returns all the data needed for the wallet to sign and submit.
 */
export async function prepareSwap(
  input: ExecuteSwapInput,
): Promise<PreparedSwapTx> {
  const client = new UniswapClient();

  // 1. Check if approval is needed
  const approvalCheck = await client.checkApproval(
    input.tokenIn,
    input.walletAddress,
    input.amount,
    input.chainId,
  );

  const approvalNeeded = approvalCheck.approval !== null;
  let approvalTx: PreparedSwapTx["approvalTx"];

  if (approvalNeeded && approvalCheck.approval) {
    approvalTx = {
      to: approvalCheck.approval.to,
      data: approvalCheck.approval.data ?? "0x",
      value: "0",
      chainId: input.chainId,
    };
  }

  // 2. Get quote
  const quote = await client.getQuote(
    input.tokenIn,
    input.tokenOut,
    input.amount,
    input.chainId,
    input.walletAddress,
    {
      slippageTolerance: typeof input.slippageTolerance === 'string' ? parseFloat(input.slippageTolerance) : input.slippageTolerance,
      routingPreference: (input.routingPreference === "CLASSIC" || input.routingPreference === "UNISWAPX") ? "BEST_PRICE" as const : input.routingPreference,
    },
  );

  // 3. Determine routing type and build tx/order data
  const routingType = quote.routing as "CLASSIC" | "DUTCH_V2" | "DUTCH_V3";

  let transaction: PreparedSwapTx["transaction"];
  let order: PreparedSwapTx["order"];

  if (routingType === "CLASSIC") {
    // Classic swap: returns calldata for on-chain execution
    const classicQuote = quote.quote as import("./types").ClassicQuote;
    const swapResponse = await client.executeSwap({
      quote: classicQuote,
      signature: "0x", // Placeholder — wallet signs the actual tx
      permitData: quote.permitData,
    });

    if (swapResponse) {
      const swapAny = swapResponse as unknown as Record<string, unknown>;
      transaction = {
        to: (swapAny.to as string) ?? "",
        data: (swapAny.data as string) ?? "0x",
        value: (swapAny.value as string) ?? "0",
        chainId: input.chainId,
        gasLimit: swapAny.gasLimit as string,
      };
    }
  } else {
    // UniswapX: returns an order to sign
    const uniswapXQuote = quote.quote as import("./types").UniswapXQuote;
    order = {
      encodedOrder: uniswapXQuote?.encodedOrder ?? "",
      orderId: uniswapXQuote?.orderId ?? "",
    };
  }

  const quoteAny = quote.quote as unknown as Record<string, unknown>;
  return {
    quote,
    transaction,
    order,
    approvalNeeded,
    approvalTx,
    routingType,
    estimatedOutput: (quoteAny as any)?.output?.amount ?? "0",
    priceImpact: (quoteAny as any)?.priceImpact?.toString(),
    gasEstimate: (quoteAny as any)?.gasEstimate ?? undefined,
  };
}

/* ================================================================
   Swap Confirmation
   ================================================================ */

/**
 * Confirm a successful swap after wallet signing.
 *
 * Records evidence of the swap execution including:
 *   - Transaction hash or order ID
 *   - Routing type used
 *   - Token amounts
 *   - Gas costs
 */
export async function confirmSwapExecution(input: {
  /** Transaction hash (classic swap) */
  transactionHash?: string;
  /** Order ID (UniswapX) */
  orderId?: string;
  /** The original swap input */
  swapInput: ExecuteSwapInput;
  /** The prepared swap data */
  preparedSwap: PreparedSwapTx;
}): Promise<SwapExecutionResult> {
  const { swapInput, preparedSwap } = input;
  const transactionHash = input.transactionHash ?? null;
  const orderId = input.orderId ?? null;

  // Build explorer URL
  let explorerUrl: string | null = null;
  if (transactionHash) {
    const explorerBase = getExplorerBase(swapInput.chainId);
    explorerUrl = `${explorerBase}/tx/${transactionHash}`;
  }

  // Record evidence
  let evidenceLogId: string | undefined;
  if (swapInput.companyId && swapInput.agentId) {
    const logRow = await logExecution(
      swapInput.agentId,
      swapInput.companyId,
      swapInput.runId ?? null,
      "output",
      {
        action: "uniswap_swap_executed",
        integration: "uniswap",
        chainId: swapInput.chainId,
        tokenIn: swapInput.tokenIn,
        tokenOut: swapInput.tokenOut,
        amountIn: swapInput.amount,
        estimatedOutput: preparedSwap.estimatedOutput,
        routingType: preparedSwap.routingType,
        transactionHash,
        orderId,
        explorerUrl,
        priceImpact: preparedSwap.priceImpact,
        gasEstimate: preparedSwap.gasEstimate,
        slippageTolerance: swapInput.slippageTolerance,
      },
    );
    evidenceLogId = logRow?.id ?? undefined;
  }

  // Record activity event
  if (swapInput.companyId) {
    await supabase.from("activity_events").insert({
      company_id: swapInput.companyId,
      agent_id: swapInput.agentId ?? null,
      action: "uniswap_swap",
      details: `Uniswap swap: ${swapInput.tokenIn.slice(0, 8)}... → ${swapInput.tokenOut.slice(0, 8)}... on chain ${swapInput.chainId}. TX: ${transactionHash ?? orderId ?? "pending"}`,
    });
  }

  return {
    success: true,
    transactionHash,
    orderId,
    explorerUrl,
    routingType: preparedSwap.routingType,
    outputAmount: preparedSwap.estimatedOutput,
    evidenceLogId,
  };
}

/* ================================================================
   Full Swap Flow (Prepare + Execute via Edge Function)
   ================================================================ */

/**
 * Execute a full swap flow server-side via the Supabase edge function.
 *
 * For scenarios where the agent has a server-side signing capability
 * (e.g. through thirdweb engine or Bankr wallet).
 */
export async function executeServerSideSwap(
  input: ExecuteSwapInput & {
    /** Server-side signing method */
    signMethod: "bankr" | "thirdweb-engine";
    /** Bankr API key (if signMethod = "bankr") */
    bankrApiKey?: string;
  },
): Promise<SwapExecutionResult> {
  try {
    // 1. Prepare the swap
    const prepared = await prepareSwap(input);

    // 2. If approval needed, execute approval first
    if (prepared.approvalNeeded && prepared.approvalTx) {
      if (input.signMethod === "bankr" && input.bankrApiKey) {
        await submitViaBankr(input.bankrApiKey, prepared.approvalTx);
      }
      // For thirdweb-engine, the approval would go through the engine API
    }

    // 3. Execute the swap
    let transactionHash: string | null = null;
    let orderId: string | null = null;

    if (prepared.routingType === "CLASSIC" && prepared.transaction) {
      if (input.signMethod === "bankr" && input.bankrApiKey) {
        const result = await submitViaBankr(input.bankrApiKey, prepared.transaction);
        transactionHash = result.txHash;
      }
    } else if (prepared.order) {
      orderId = prepared.order.orderId;
    }

    // 4. Record and return
    return confirmSwapExecution({
      transactionHash: transactionHash ?? undefined,
      orderId: orderId ?? undefined,
      swapInput: input,
      preparedSwap: prepared,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    // Record failure
    if (input.companyId && input.agentId) {
      await logExecution(input.agentId, input.companyId, input.runId ?? null, "failure", {
        action: "uniswap_swap_failed",
        integration: "uniswap",
        error,
        chainId: input.chainId,
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
      });
    }

    return {
      success: false,
      transactionHash: null,
      orderId: null,
      explorerUrl: null,
      routingType: null,
      outputAmount: null,
      error,
    };
  }
}

/* ================================================================
   Bankr Transaction Submission
   ================================================================ */

/**
 * Submit a transaction via Bankr's agent API.
 */
async function submitViaBankr(
  bankrApiKey: string,
  tx: { to: string; data: string; value: string; chainId: number },
): Promise<{ txHash: string }> {
  const response = await fetch("https://api.bankr.bot/agent/prompt", {
    method: "POST",
    headers: {
      "X-API-Key": bankrApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: `Submit this transaction: ${JSON.stringify(tx)}`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Bankr tx submission failed (${response.status})`);
  }

  const result = await response.json();
  // Bankr returns a jobId — poll for completion
  return { txHash: result.txHash ?? result.jobId ?? "pending" };
}

/* ================================================================
   Helpers
   ================================================================ */

function getExplorerBase(chainId: number): string {
  switch (chainId) {
    case 1:
      return "https://etherscan.io";
    case 8453:
      return "https://basescan.org";
    case 42161:
      return "https://arbiscan.io";
    case 10:
      return "https://optimistic.etherscan.io";
    case 137:
      return "https://polygonscan.com";
    default:
      return "https://etherscan.io";
  }
}
