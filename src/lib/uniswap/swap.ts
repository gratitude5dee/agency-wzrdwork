/**
 * Uniswap Trade API — High-Level Swap
 *
 * Chains the three-step swap workflow:
 *   1. Check approval (Permit2)
 *   2. Get quote (best price)
 *   3. Execute swap (classic) or create order (UniswapX)
 *
 * Returns a structured SwapResult with the transaction hash or order ID.
 */

import { UniswapClient } from "./client";
import type {
  SupportedChainId,
  SwapResult,
  QuoteResponse,
  ClassicQuote,
  UniswapXQuote,
  QuoteRequest,
} from "./types";

/** Options for the high-level swap function */
export interface SwapOptions {
  /** Permit2 signature from the wallet (required for swap execution) */
  signature?: string;
  /** Slippage tolerance as a percentage (e.g. 0.5 for 0.5%) */
  slippageTolerance?: number;
  /** Trade type — defaults to EXACT_INPUT */
  type?: QuoteRequest["type"];
  /** Protocol restrictions */
  protocols?: QuoteRequest["protocols"];
  /** Routing preference */
  routingPreference?: QuoteRequest["routingPreference"];
  /** A pre-configured UniswapClient instance. If omitted, a new one is created. */
  client?: UniswapClient;
}

/**
 * Determine whether a quote response uses classic routing.
 * Classic routing quotes contain `chainId` directly on the quote object.
 */
function isClassicQuote(
  quote: ClassicQuote | UniswapXQuote,
): quote is ClassicQuote {
  return "chainId" in quote && "route" in quote;
}

/**
 * High-level swap function that chains: check approval → get quote → execute swap.
 *
 * Returns a structured result with routing info, transaction hash (classic)
 * or order ID (UniswapX), and the original quote and swap responses.
 *
 * @param tokenIn       - Address of the token to send
 * @param tokenOut      - Address of the token to receive
 * @param amount        - Amount in the token's base units (string)
 * @param chainId       - Chain ID (e.g. 1, 42161, 8453, 42220)
 * @param walletAddress - Wallet address that will send tokens and receive output
 * @param options       - Optional swap parameters and pre-built client
 * @returns A SwapResult describing the outcome
 */
export async function swap(
  tokenIn: string,
  tokenOut: string,
  amount: string,
  chainId: SupportedChainId,
  walletAddress: string,
  options: SwapOptions = {},
): Promise<SwapResult> {
  const client = options.client ?? new UniswapClient();

  // -----------------------------------------------------------------------
  // Step 1: Check approval
  // -----------------------------------------------------------------------
  let approvalNeeded = false;
  let approvalTransaction = null;

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
    return {
      success: false,
      routing: "CLASSIC",
      transactionHash: null,
      quoteResponse: null as unknown as QuoteResponse,
      swapResponse: null,
      approvalNeeded: false,
      approvalTransaction: null,
      error: `Approval check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // -----------------------------------------------------------------------
  // Step 2: Get quote
  // -----------------------------------------------------------------------
  let quoteResponse: QuoteResponse;

  try {
    quoteResponse = await client.getQuote(
      tokenIn,
      tokenOut,
      amount,
      chainId,
      walletAddress,
      {
        type: options.type,
        slippageTolerance: options.slippageTolerance,
        protocols: options.protocols,
        routingPreference: options.routingPreference,
      },
    );
  } catch (err) {
    return {
      success: false,
      routing: "CLASSIC",
      transactionHash: null,
      quoteResponse: null as unknown as QuoteResponse,
      swapResponse: null,
      approvalNeeded,
      approvalTransaction,
      error: `Quote failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // -----------------------------------------------------------------------
  // Step 3: Execute swap or create order based on routing
  // -----------------------------------------------------------------------
  try {
    if (isClassicQuote(quoteResponse.quote)) {
      // Classic swap (v2/v3/v4 pools)
      const swapResponse = await client.executeSwap({
        quote: quoteResponse.quote,
        signature: options.signature,
        permitData: quoteResponse.permitData,
        simulateTransaction: true,
        refreshGasPrice: true,
        safetyMode: "SAFE",
      });

      return {
        success: true,
        routing: quoteResponse.routing,
        transactionHash: swapResponse.requestId,
        quoteResponse,
        swapResponse,
        approvalNeeded,
        approvalTransaction,
      };
    } else {
      // UniswapX gasless order
      if (!options.signature) {
        return {
          success: false,
          routing: quoteResponse.routing,
          transactionHash: null,
          quoteResponse,
          swapResponse: null,
          approvalNeeded,
          approvalTransaction,
          error:
            "UniswapX orders require a signature. Provide options.signature.",
        };
      }

      const orderResponse = await client.createOrder({
        signature: options.signature,
        quote: quoteResponse.quote as UniswapXQuote,
        routing: quoteResponse.routing,
      });

      return {
        success: true,
        routing: quoteResponse.routing,
        transactionHash: orderResponse.orderId,
        quoteResponse,
        swapResponse: orderResponse,
        approvalNeeded,
        approvalTransaction,
      };
    }
  } catch (err) {
    return {
      success: false,
      routing: quoteResponse.routing,
      transactionHash: null,
      quoteResponse,
      swapResponse: null,
      approvalNeeded,
      approvalTransaction,
      error: `Swap execution failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
