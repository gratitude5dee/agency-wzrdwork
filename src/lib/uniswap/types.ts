/**
 * Uniswap Trade API — Types
 *
 * TypeScript types matching the Uniswap Trade API schema for
 * check_approval, quote, swap, and order endpoints.
 *
 * @see https://api-docs.uniswap.org/api-reference/swapping/approval
 * @see https://api-docs.uniswap.org/api-reference/swapping/quote
 * @see https://api-docs.uniswap.org/api-reference/swapping/create_protocol_swap
 * @see https://api-docs.uniswap.org/api-reference/swapping/create_uniswapx_order
 */

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Supported chain IDs on the Uniswap Trade API */
export type SupportedChainId =
  | 1
  | 10
  | 56
  | 130
  | 137
  | 143
  | 196
  | 324
  | 480
  | 1868
  | 8453
  | 10143
  | 42161
  | 42220
  | 43114
  | 59144
  | 81457
  | 7777777;

/** Gas urgency level */
export type Urgency = "normal" | "fast" | "urgent";

/** Trade type — either exact-input or exact-output */
export type TradeType = "EXACT_INPUT" | "EXACT_OUTPUT";

/** Routing strategies returned by /quote */
export type Routing =
  | "CLASSIC"
  | "DUTCH_LIMIT"
  | "DUTCH_V2"
  | "DUTCH_V3"
  | "BRIDGE"
  | "LIMIT_ORDER"
  | "PRIORITY"
  | "WRAP"
  | "UNWRAP"
  | "CHAINED";

/** A transaction object returned by the API */
export interface TransactionRequest {
  to: string;
  from: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

/** Aggregated output entry */
export interface AggregatedOutput {
  token: string;
  amount: string;
  recipient: string;
  bps: number;
  minAmount: string;
}

// ---------------------------------------------------------------------------
// Check Approval
// ---------------------------------------------------------------------------

/** Request body for POST /check_approval */
export interface CheckApprovalRequest {
  walletAddress: string;
  token: string;
  amount: string;
  chainId: SupportedChainId;
  urgency?: Urgency;
  includeGasInfo?: boolean;
  tokenOut?: string;
  tokenOutChainId?: SupportedChainId;
}

/** Response from POST /check_approval */
export interface CheckApprovalResponse {
  requestId: string;
  approval: TransactionRequest | null;
  cancel: TransactionRequest | null;
  gasFee?: string;
  cancelGasFee?: string;
}

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

/** Allowed protocols for the quote request */
export type Protocol = "V2" | "V3" | "V4" | "UNISWAPX" | "UNISWAPX_V2" | "UNISWAPX_V3";

/** Routing preference */
export type RoutingPreference = "BEST_PRICE" | "FASTEST";

/** Request body for POST /quote */
export interface QuoteRequest {
  type: TradeType;
  amount: string;
  tokenInChainId: SupportedChainId;
  tokenOutChainId: SupportedChainId;
  tokenIn: string;
  tokenOut: string;
  swapper: string;
  slippageTolerance?: number;
  autoSlippage?: "DEFAULT";
  routingPreference?: RoutingPreference;
  protocols?: Protocol[];
  urgency?: Urgency;
  generatePermitAsTransaction?: boolean;
  permitAmount?: "FULL" | "EXACT";
}

/** Permit data returned alongside a quote */
export interface PermitData {
  domain: Record<string, unknown>;
  values: Record<string, unknown>;
  types: Record<string, unknown>;
}

/** Classic quote object (CLASSIC routing) */
export interface ClassicQuote {
  chainId: number;
  input: { token: string; amount: string };
  output: { token: string; amount: string; recipient: string };
  swapper: string;
  route: unknown[][];
  slippage: number;
  tradeType: TradeType;
  quoteId: string;
  gasFeeUSD: string;
  gasFeeQuote: string;
  gasUseEstimate: string;
  priceImpact: number;
  txFailureReasons: string[];
  maxPriorityFeePerGas?: string;
  maxFeePerGas?: string;
  gasFee: string;
  routeString: string;
  blockNumber: string;
  aggregatedOutputs: AggregatedOutput[];
  portionBips?: number;
  portionAmount?: string;
  portionRecipient?: string;
}

/** UniswapX order info (DUTCH_V2 / DUTCH_V3 / PRIORITY routing) */
export interface UniswapXQuote {
  encodedOrder: string;
  orderId: string;
  orderInfo: {
    chainId: number;
    nonce: string;
    reactor: string;
    swapper: string;
    deadline: number;
    input: { startAmount: string; endAmount: string; token: string };
    outputs: Array<{
      startAmount: string;
      endAmount: string;
      token: string;
      recipient: string;
    }>;
    additionalValidationContract?: string;
    additionalValidationData?: string;
    cosigner?: string;
  };
  quoteId: string;
  slippageTolerance: number;
  classicGasUseEstimateUSD?: string;
  portionBips?: number;
  portionAmount?: string;
  portionRecipient?: string;
  aggregatedOutputs?: AggregatedOutput[];
}

/** Full /quote response */
export interface QuoteResponse {
  requestId: string;
  quote: ClassicQuote | UniswapXQuote;
  routing: Routing;
  permitData: PermitData | null;
  permitTransaction?: TransactionRequest | null;
  permitGasFee?: string;
}

// ---------------------------------------------------------------------------
// Swap (/swap — classic routes)
// ---------------------------------------------------------------------------

/** Request body for POST /swap */
export interface SwapRequest {
  quote: ClassicQuote;
  signature?: string;
  permitData?: PermitData | null;
  simulateTransaction?: boolean;
  refreshGasPrice?: boolean;
  safetyMode?: "SAFE";
  deadline?: number;
  urgency?: Urgency;
}

/** Response from POST /swap */
export interface SwapResponse {
  requestId: string;
  swap: TransactionRequest;
  gasFee: string;
}

// ---------------------------------------------------------------------------
// Order (/order — UniswapX gasless orders)
// ---------------------------------------------------------------------------

/** Request body for POST /order */
export interface OrderRequest {
  signature: string;
  quote: UniswapXQuote;
  routing?: Routing;
}

/** Response from POST /order */
export interface OrderResponse {
  requestId: string;
  orderId: string;
  orderStatus:
    | "open"
    | "expired"
    | "error"
    | "cancelled"
    | "filled"
    | "unverified"
    | "insufficient-funds";
}

// ---------------------------------------------------------------------------
// High-level swap result
// ---------------------------------------------------------------------------

/** Result returned by the high-level swap() function */
export interface SwapResult {
  success: boolean;
  routing: Routing;
  /** Transaction hash (for classic swaps) or order ID (for UniswapX) */
  transactionHash: string | null;
  /** The original quote response */
  quoteResponse: QuoteResponse;
  /** The swap calldata transaction (classic) or order result (UniswapX) */
  swapResponse: SwapResponse | OrderResponse | null;
  /** If an approval transaction was needed */
  approvalNeeded: boolean;
  approvalTransaction: TransactionRequest | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Client configuration
// ---------------------------------------------------------------------------

/** Configuration passed to the UniswapClient constructor */
export interface UniswapClientConfig {
  /** Uniswap Trade API key. Defaults to VITE_UNISWAP_API_KEY env var. */
  apiKey?: string;
  /** Base URL for the Trade API. Defaults to UNISWAP_TRADE_API_BASE_URL. */
  baseUrl?: string;
}
