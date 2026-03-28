/**
 * Uniswap Trade API — Tests
 *
 * Tests for the UniswapClient, swap() function, types, and barrel exports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UniswapClient, UNISWAP_TRADE_API_BASE_URL } from "@/lib/uniswap/client";
import { swap } from "@/lib/uniswap/swap";
import { TEST_UNISWAP_PROXY_URL } from "@/test/test-env";
import type {
  CheckApprovalResponse,
  QuoteResponse,
  SwapResponse,
  OrderResponse,
  ClassicQuote,
  UniswapXQuote,
} from "@/lib/uniswap/types";

// ---------------------------------------------------------------------------
// Mock data — fake addresses used for testing only (not real tokens/wallets)
// ---------------------------------------------------------------------------

const FAKE_TOKEN_A = "mock-token-in";
const FAKE_TOKEN_B = "mock-token-out";
const FAKE_WALLET = "mock-wallet-addr";
const FAKE_POOL = "mock-pool-addr";
const FAKE_REACTOR = "mock-reactor-addr";
const FAKE_ROUTER = "mock-router-addr";

const MOCK_APPROVAL_RESPONSE: CheckApprovalResponse = {
  requestId: "req-approval-1",
  approval: {
    to: FAKE_TOKEN_A,
    from: FAKE_WALLET,
    data: "0x095ea7b3",
    value: "0x00",
    chainId: 1,
    gasLimit: "56344",
    maxFeePerGas: "4656",
    maxPriorityFeePerGas: "2000",
  },
  cancel: null,
  gasFee: "262366",
};

const MOCK_APPROVAL_NOT_NEEDED: CheckApprovalResponse = {
  requestId: "req-approval-2",
  approval: null,
  cancel: null,
};

const MOCK_CLASSIC_QUOTE: ClassicQuote = {
  chainId: 1,
  input: { token: FAKE_TOKEN_A, amount: "1000000" },
  output: { token: FAKE_TOKEN_B, amount: "5000000", recipient: FAKE_WALLET },
  swapper: FAKE_WALLET,
  route: [[{ type: "v3-pool", address: FAKE_POOL }]],
  slippage: 0.5,
  tradeType: "EXACT_INPUT",
  quoteId: "quote-123",
  gasFeeUSD: "1.50",
  gasFeeQuote: "500000",
  gasUseEstimate: "180000",
  priceImpact: 0.1,
  txFailureReasons: [],
  maxFeePerGas: "5000",
  maxPriorityFeePerGas: "2000",
  gasFee: "500000",
  routeString: "[V3] 100% = TokenIn -- 0.3% TokenOut",
  blockNumber: "19000000",
  aggregatedOutputs: [
    { token: FAKE_TOKEN_B, amount: "5000000", recipient: FAKE_WALLET, bps: 10000, minAmount: "4975000" },
  ],
};

const MOCK_CLASSIC_QUOTE_RESPONSE: QuoteResponse = {
  requestId: "req-quote-1",
  quote: MOCK_CLASSIC_QUOTE,
  routing: "CLASSIC",
  permitData: {
    domain: { name: "Permit2", chainId: 1 },
    values: { details: { token: FAKE_TOKEN_A } },
    types: { PermitSingle: [] },
  },
};

const MOCK_UNISWAPX_QUOTE: UniswapXQuote = {
  encodedOrder: "0xencoded",
  orderId: "order-456",
  orderInfo: {
    chainId: 1,
    nonce: "1",
    reactor: FAKE_REACTOR,
    swapper: FAKE_WALLET,
    deadline: 1700000000,
    input: { startAmount: "1000000", endAmount: "1000000", token: FAKE_TOKEN_A },
    outputs: [
      { startAmount: "5000000", endAmount: "4950000", token: FAKE_TOKEN_B, recipient: FAKE_WALLET },
    ],
  },
  quoteId: "quote-789",
  slippageTolerance: 0.5,
};

const MOCK_UNISWAPX_QUOTE_RESPONSE: QuoteResponse = {
  requestId: "req-quote-2",
  quote: MOCK_UNISWAPX_QUOTE,
  routing: "DUTCH_V2",
  permitData: null,
};

const MOCK_SWAP_RESPONSE: SwapResponse = {
  requestId: "req-swap-1",
  swap: {
    to: FAKE_ROUTER,
    from: FAKE_WALLET,
    data: "0x3593564c",
    value: "0x00",
    chainId: 1,
    gasLimit: "180000",
    maxFeePerGas: "5000",
    maxPriorityFeePerGas: "2000",
  },
  gasFee: "900000",
};

const MOCK_ORDER_RESPONSE: OrderResponse = {
  requestId: "req-order-1",
  orderId: "order-filled-789",
  orderStatus: "open",
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let fetchSpy: ReturnType<typeof vi.fn>;

function mockFetchResponses(...responses: unknown[]) {
  for (const resp of responses) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(resp),
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("UNISWAP_TRADE_API_BASE_URL", () => {
  it("points to the correct gateway endpoint", () => {
    expect(UNISWAP_TRADE_API_BASE_URL).toBe(
      "https://trade-api.gateway.uniswap.org/v1",
    );
  });
});

describe("UniswapClient", () => {
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a client with default base URL", () => {
    const client = new UniswapClient();
    expect(client.getBaseUrl()).toBe(TEST_UNISWAP_PROXY_URL);
  });

  it("allows overriding the base URL", () => {
    const client = new UniswapClient({
      apiKey: "test-key",
      baseUrl: "https://custom.api.com",
    });
    expect(client.getBaseUrl()).toBe("https://custom.api.com");
  });

  it("uses edge function URL by default", () => {
    const client = new UniswapClient();
    expect(client.getBaseUrl()).toBe(TEST_UNISWAP_PROXY_URL);
  });

  // ----- checkApproval -----

  describe("checkApproval", () => {
    it("sends POST to /check_approval through the proxy with correct body", async () => {
      mockFetchResponses(MOCK_APPROVAL_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      await client.checkApproval(
        "0xTokenAddr",
        "0xWalletAddr",
        "1000000",
        1,
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      // Proxy pattern: client sends to edge function with ?endpoint= query param
      expect(url).toBe(`${TEST_UNISWAP_PROXY_URL}?endpoint=%2Fcheck_approval`);
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body);
      expect(body.token).toBe("0xTokenAddr");
      expect(body.walletAddress).toBe("0xWalletAddr");
      expect(body.amount).toBe("1000000");
      expect(body.chainId).toBe(1);
      expect(body.includeGasInfo).toBe(true);
    });

    it("does not include x-api-key header (edge function adds it server-side)", async () => {
      mockFetchResponses(MOCK_APPROVAL_RESPONSE);
      const client = new UniswapClient({ apiKey: "my-secret" });

      await client.checkApproval("0xToken", "0xWallet", "100", 42161);

      const [, init] = fetchSpy.mock.calls[0];
      // Proxy pattern: API key is handled by the edge function
      expect(init.headers["x-api-key"]).toBeUndefined();
      expect(init.headers["Content-Type"]).toBe("application/json");
    });

    it("returns approval transaction when approval is needed", async () => {
      mockFetchResponses(MOCK_APPROVAL_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      const result = await client.checkApproval("0xToken", "0xWallet", "100", 1);
      expect(result.approval).not.toBeNull();
      expect(result.approval?.to).toBe(FAKE_TOKEN_A);
    });

    it("returns null approval when no approval is needed", async () => {
      mockFetchResponses(MOCK_APPROVAL_NOT_NEEDED);
      const client = new UniswapClient({ apiKey: "test-key" });

      const result = await client.checkApproval("0xToken", "0xWallet", "100", 1);
      expect(result.approval).toBeNull();
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });
      const client = new UniswapClient({ apiKey: "bad-key" });

      await expect(
        client.checkApproval("0xToken", "0xWallet", "100", 1),
      ).rejects.toThrow("Uniswap Trade API error (401): Unauthorized");
    });
  });

  // ----- getQuote -----

  describe("getQuote", () => {
    it("sends POST to /quote through the proxy with required fields", async () => {
      mockFetchResponses(MOCK_CLASSIC_QUOTE_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      await client.getQuote("0xIn", "0xOut", "1000000", 1, "0xRecipient");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${TEST_UNISWAP_PROXY_URL}?endpoint=%2Fquote`);
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body);
      expect(body.tokenIn).toBe("0xIn");
      expect(body.tokenOut).toBe("0xOut");
      expect(body.amount).toBe("1000000");
      expect(body.tokenInChainId).toBe(1);
      expect(body.tokenOutChainId).toBe(1);
      expect(body.swapper).toBe("0xRecipient");
      expect(body.type).toBe("EXACT_INPUT");
      expect(body.routingPreference).toBe("BEST_PRICE");
    });

    it("does not include Uniswap-specific headers (edge function adds them server-side)", async () => {
      mockFetchResponses(MOCK_CLASSIC_QUOTE_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      await client.getQuote("0xIn", "0xOut", "1000000", 1, "0xRecipient");

      const [, init] = fetchSpy.mock.calls[0];
      // Proxy pattern: Uniswap-specific headers are added by the edge function
      expect(init.headers["x-universal-router-version"]).toBeUndefined();
      expect(init.headers["x-api-key"]).toBeUndefined();
    });

    it("passes optional slippageTolerance and protocols", async () => {
      mockFetchResponses(MOCK_CLASSIC_QUOTE_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      await client.getQuote("0xIn", "0xOut", "1000000", 42161, "0xRecipient", {
        slippageTolerance: 0.5,
        protocols: ["V3", "V4"],
      });

      const [, init] = fetchSpy.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.slippageTolerance).toBe(0.5);
      expect(body.protocols).toEqual(["V3", "V4"]);
      expect(body.tokenInChainId).toBe(42161);
      expect(body.tokenOutChainId).toBe(42161);
    });

    it("returns quote response with routing info", async () => {
      mockFetchResponses(MOCK_CLASSIC_QUOTE_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      const result = await client.getQuote("0xIn", "0xOut", "1000000", 1, "0xRecipient");
      expect(result.routing).toBe("CLASSIC");
      expect(result.requestId).toBe("req-quote-1");
      expect(result.permitData).not.toBeNull();
    });

    it("throws on API error", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve("Rate limited"),
      });
      const client = new UniswapClient({ apiKey: "test-key" });

      await expect(
        client.getQuote("0xIn", "0xOut", "1000000", 1, "0xRecipient"),
      ).rejects.toThrow("Uniswap Trade API error (429): Rate limited");
    });
  });

  // ----- executeSwap -----

  describe("executeSwap", () => {
    it("sends POST to /swap through the proxy with quote and permitData", async () => {
      mockFetchResponses(MOCK_SWAP_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      await client.executeSwap({
        quote: MOCK_CLASSIC_QUOTE,
        signature: "0xsig...",
        permitData: MOCK_CLASSIC_QUOTE_RESPONSE.permitData,
        simulateTransaction: true,
      });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${TEST_UNISWAP_PROXY_URL}?endpoint=%2Fswap`);
      expect(init.method).toBe("POST");
      // Proxy pattern: Uniswap-specific headers are added by the edge function
      expect(init.headers["x-universal-router-version"]).toBeUndefined();

      const body = JSON.parse(init.body);
      expect(body.quote.chainId).toBe(1);
      expect(body.quote.input.token).toBe(FAKE_TOKEN_A);
      expect(body.quote.tradeType).toBe("EXACT_INPUT");
      expect(body.signature).toBe("0xsig...");
      expect(body.simulateTransaction).toBe(true);
    });

    it("returns swap transaction data", async () => {
      mockFetchResponses(MOCK_SWAP_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      const result = await client.executeSwap({ quote: MOCK_CLASSIC_QUOTE });
      expect(result.swap.to).toBe(FAKE_ROUTER);
      expect(result.swap.from).toBe(FAKE_WALLET);
      expect(result.gasFee).toBe("900000");
    });
  });

  // ----- createOrder -----

  describe("createOrder", () => {
    it("sends POST to /order through the proxy with encoded order and signature", async () => {
      mockFetchResponses(MOCK_ORDER_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      await client.createOrder({
        signature: "0xOrderSig",
        quote: MOCK_UNISWAPX_QUOTE,
        routing: "DUTCH_V2",
      });

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe(`${TEST_UNISWAP_PROXY_URL}?endpoint=%2Forder`);
      expect(init.method).toBe("POST");

      const body = JSON.parse(init.body);
      expect(body.signature).toBe("0xOrderSig");
      expect(body.quote.encodedOrder).toBe("0xencoded");
      expect(body.quote.orderId).toBe("order-456");
      expect(body.routing).toBe("DUTCH_V2");
    });

    it("returns order status", async () => {
      mockFetchResponses(MOCK_ORDER_RESPONSE);
      const client = new UniswapClient({ apiKey: "test-key" });

      const result = await client.createOrder({
        signature: "0xSig",
        quote: MOCK_UNISWAPX_QUOTE,
      });
      expect(result.orderId).toBe("order-filled-789");
      expect(result.orderStatus).toBe("open");
    });
  });
});

// ---------------------------------------------------------------------------
// swap() high-level function
// ---------------------------------------------------------------------------

describe("swap() high-level function", () => {
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("chains approval → quote → swap for classic route", async () => {
    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_CLASSIC_QUOTE_RESPONSE,
      MOCK_SWAP_RESPONSE,
    );

    const result = await swap(
      "0xTokenIn",
      "0xTokenOut",
      "1000000",
      1,
      "0xWallet",
      { client: new UniswapClient({ apiKey: "test" }) },
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
    expect(result.routing).toBe("CLASSIC");
    expect(result.transactionHash).toBe("req-swap-1");
    expect(result.approvalNeeded).toBe(false);
    expect(result.approvalTransaction).toBeNull();
  });

  it("detects when approval is needed", async () => {
    mockFetchResponses(
      MOCK_APPROVAL_RESPONSE,
      MOCK_CLASSIC_QUOTE_RESPONSE,
      MOCK_SWAP_RESPONSE,
    );

    const result = await swap(
      "0xTokenIn",
      "0xTokenOut",
      "1000000",
      1,
      "0xWallet",
      { client: new UniswapClient({ apiKey: "test" }) },
    );

    expect(result.success).toBe(true);
    expect(result.approvalNeeded).toBe(true);
    expect(result.approvalTransaction).not.toBeNull();
    expect(result.approvalTransaction?.to).toBe(FAKE_TOKEN_A);
  });

  it("handles UniswapX routing with signature", async () => {
    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_UNISWAPX_QUOTE_RESPONSE,
      MOCK_ORDER_RESPONSE,
    );

    const result = await swap(
      "0xTokenIn",
      "0xTokenOut",
      "1000000",
      1,
      "0xWallet",
      { signature: "0xSig", client: new UniswapClient({ apiKey: "test" }) },
    );

    expect(result.success).toBe(true);
    expect(result.routing).toBe("DUTCH_V2");
    expect(result.transactionHash).toBe("order-filled-789");
  });

  it("fails UniswapX routing without signature", async () => {
    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_UNISWAPX_QUOTE_RESPONSE,
    );

    const result = await swap(
      "0xTokenIn",
      "0xTokenOut",
      "1000000",
      1,
      "0xWallet",
      { client: new UniswapClient({ apiKey: "test" }) },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("signature");
  });

  it("returns error when approval check fails", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const result = await swap(
      "0xTokenIn",
      "0xTokenOut",
      "1000000",
      1,
      "0xWallet",
      { client: new UniswapClient({ apiKey: "test" }) },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Approval check failed");
  });

  it("returns error when quote fails", async () => {
    mockFetchResponses(MOCK_APPROVAL_NOT_NEEDED);
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request"),
    });

    const result = await swap(
      "0xTokenIn",
      "0xTokenOut",
      "1000000",
      1,
      "0xWallet",
      { client: new UniswapClient({ apiKey: "test" }) },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Quote failed");
  });

  it("returns error when swap execution fails", async () => {
    mockFetchResponses(MOCK_APPROVAL_NOT_NEEDED, MOCK_CLASSIC_QUOTE_RESPONSE);
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Simulation failed"),
    });

    const result = await swap(
      "0xTokenIn",
      "0xTokenOut",
      "1000000",
      1,
      "0xWallet",
      { client: new UniswapClient({ apiKey: "test" }) },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Swap execution failed");
  });

  it("constructs request body with required fields matching Trade API schema", async () => {
    mockFetchResponses(
      MOCK_APPROVAL_NOT_NEEDED,
      MOCK_CLASSIC_QUOTE_RESPONSE,
      MOCK_SWAP_RESPONSE,
    );

    await swap(
      "0xUSDC",
      "0xWETH",
      "1000000",
      42161,
      "0xMyWallet",
      {
        slippageTolerance: 0.5,
        client: new UniswapClient({ apiKey: "test" }),
      },
    );

    // Verify the quote request body (second fetch call)
    const [, quoteInit] = fetchSpy.mock.calls[1];
    const quoteBody = JSON.parse(quoteInit.body);
    expect(quoteBody.chainId ?? quoteBody.tokenInChainId).toBeTruthy();
    expect(quoteBody.tokenIn).toBe("0xUSDC");
    expect(quoteBody.tokenOut).toBe("0xWETH");
    expect(quoteBody.amount).toBe("1000000");
    expect(quoteBody.type).toBe("EXACT_INPUT");
    expect(quoteBody.swapper).toBe("0xMyWallet");
    expect(quoteBody.tokenInChainId).toBe(42161);
    expect(quoteBody.tokenOutChainId).toBe(42161);
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("Uniswap index re-exports", () => {
  it("exports UniswapClient class from the barrel", async () => {
    const mod = await import("@/lib/uniswap/index");
    expect(mod.UniswapClient).toBeDefined();
    expect(typeof mod.UniswapClient).toBe("function");
  });

  it("exports UNISWAP_TRADE_API_BASE_URL constant", async () => {
    const mod = await import("@/lib/uniswap/index");
    expect(mod.UNISWAP_TRADE_API_BASE_URL).toBe(
      "https://trade-api.gateway.uniswap.org/v1",
    );
  });

  it("exports swap function from the barrel", async () => {
    const mod = await import("@/lib/uniswap/index");
    expect(mod.swap).toBeDefined();
    expect(typeof mod.swap).toBe("function");
  });
});
