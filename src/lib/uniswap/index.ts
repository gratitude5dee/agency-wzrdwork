/**
 * Uniswap Trade API — Public API
 *
 * Re-exports the main classes, functions, types, and constants
 * used by the rest of the application.
 */

export { UniswapClient, UNISWAP_TRADE_API_BASE_URL } from "./client";

export { swap } from "./swap";
export type { SwapOptions } from "./swap";

export { loadUniswapConfig, saveUniswapConfig } from "./config";
export type { UniswapConfig } from "./config";

export { executeQuoteFlow, executeSwapFlow } from "./quote-swap";
export type {
  UniswapFlowInput,
  QuoteFlowResult,
  SwapFlowResult,
} from "./quote-swap";

export type {
  SupportedChainId,
  Urgency,
  TradeType,
  Routing,
  TransactionRequest,
  AggregatedOutput,
  CheckApprovalRequest,
  CheckApprovalResponse,
  Protocol,
  RoutingPreference,
  QuoteRequest,
  PermitData,
  ClassicQuote,
  UniswapXQuote,
  QuoteResponse,
  SwapRequest,
  SwapResponse,
  OrderRequest,
  OrderResponse,
  SwapResult,
  UniswapClientConfig,
} from "./types";
