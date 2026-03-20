/**
 * Uniswap Trade API — Client
 *
 * UniswapClient now proxies requests through a Supabase edge function
 * so the API key never leaves the server.
 */

import type {
  CheckApprovalRequest,
  CheckApprovalResponse,
  QuoteRequest,
  QuoteResponse,
  SwapRequest,
  SwapResponse,
  OrderRequest,
  OrderResponse,
  UniswapClientConfig,
  SupportedChainId,
} from "./types";

/** Kept for reference */
export const UNISWAP_TRADE_API_BASE_URL =
  "https://trade-api.gateway.uniswap.org/v1";

/** Edge function URL */
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/uniswap-proxy`;

export class UniswapClient {
  private readonly baseUrl: string;

  constructor(config: UniswapClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? EDGE_FUNCTION_URL;
  }

  private async post<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Uniswap Trade API error (${response.status}): ${errorText}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async checkApproval(
    tokenAddress: string,
    walletAddress: string,
    amount: string,
    chainId: SupportedChainId,
  ): Promise<CheckApprovalResponse> {
    const body: CheckApprovalRequest = {
      token: tokenAddress,
      walletAddress,
      amount,
      chainId,
      includeGasInfo: true,
    };
    return this.post<CheckApprovalResponse>("/check_approval", body);
  }

  async getQuote(
    tokenIn: string,
    tokenOut: string,
    amount: string,
    chainId: SupportedChainId,
    recipient: string,
    options: Partial<
      Omit<
        QuoteRequest,
        "tokenIn" | "tokenOut" | "amount" | "tokenInChainId" | "tokenOutChainId" | "swapper"
      >
    > = {},
  ): Promise<QuoteResponse> {
    const body: QuoteRequest = {
      type: options.type ?? "EXACT_INPUT",
      amount,
      tokenInChainId: chainId,
      tokenOutChainId: chainId,
      tokenIn,
      tokenOut,
      swapper: recipient,
      slippageTolerance: options.slippageTolerance,
      routingPreference: options.routingPreference ?? "BEST_PRICE",
      protocols: options.protocols,
      urgency: options.urgency,
    };
    return this.post<QuoteResponse>("/quote", body);
  }

  async executeSwap(request: SwapRequest): Promise<SwapResponse> {
    return this.post<SwapResponse>("/swap", request);
  }

  async createOrder(request: OrderRequest): Promise<OrderResponse> {
    return this.post<OrderResponse>("/order", request);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
