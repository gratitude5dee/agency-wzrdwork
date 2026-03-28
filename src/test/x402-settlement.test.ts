import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";

/* ---------- Supabase mock ---------- */

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

function buildChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.insert = mockInsert.mockReturnValue(chain);
  chain.update = mockUpdate.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.order = mockOrder.mockReturnValue(chain);
  chain.single = mockSingle;
  chain.maybeSingle = mockMaybeSingle;
  return chain;
}

const mockFunctionsInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => buildChain()),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
      }),
    },
    functions: {
      invoke: mockFunctionsInvoke,
    },
  },
}));

/* ---------- helpers ---------- */

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = createTestQueryClient();
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

/** A valid unpaid invoice fixture */
const UNPAID_INVOICE = {
  id: "inv-settle-1",
  company_id: "comp-1",
  agent_id: "agent-1",
  seller_wallet: "0xSELLER_WALLET",
  buyer_wallet: null,
  description: "Agent compute services",
  line_items: [
    { description: "GPU hours", quantity: 10, price: "5.00" },
  ],
  amount_usdc: 50,
  paid: false,
  tx_hash: null,
  chain_id: 42161,
  created_at: "2025-01-01T00:00:00Z",
  paid_at: null,
};

/** A valid settlement proof that matches the unpaid invoice */
const VALID_PROOF = {
  invoiceId: "inv-settle-1",
  payerWallet: "0xPAYER_WALLET",
  txHash: "0xTX_HASH_123",
  amountUsdc: 50,
  chainId: 42161,
  recipientWallet: "0xSELLER_WALLET",
};

/* ================================================================
   VAL-PAY-001: Invoice creation stores seller, chain, line items,
   and unpaid-state economics that match the submitted invoice
   ================================================================ */

describe("VAL-PAY-001: Invoice creation data shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an invoice with seller, chain, line items, and unpaid state", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { createInvoice } = await import("@/lib/x402/invoices");

    let insertedPayload: unknown;
    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.insert = vi.fn((payload: unknown) => {
        insertedPayload = payload;
        return chain;
      });
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({
        data: UNPAID_INVOICE,
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await createInvoice(
      "comp-1",
      "agent-1",
      "0xSELLER_WALLET",
      "Agent compute services",
      [{ description: "GPU hours", quantity: 10, price: "5.00" }],
      50,
    );

    // Verify the invoice shape
    expect(result.seller_wallet).toBe("0xSELLER_WALLET");
    expect(result.chain_id).toBe(42161);
    expect(result.line_items).toEqual([
      { description: "GPU hours", quantity: 10, price: "5.00" },
    ]);
    expect(result.amount_usdc).toBe(50);
    expect(result.paid).toBe(false);
    expect(result.buyer_wallet).toBeNull();
    expect(result.tx_hash).toBeNull();
    expect(result.paid_at).toBeNull();

    // Verify the insert payload sent to Supabase
    expect(insertedPayload).toMatchObject({
      company_id: "comp-1",
      agent_id: "agent-1",
      seller_wallet: "0xSELLER_WALLET",
      paid: false,
      tx_hash: null,
      chain_id: 42161,
      amount_usdc: 50,
    });
  });

  it("total economics match submitted line items", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { createInvoice } = await import("@/lib/x402/invoices");

    const lineItems = [
      { description: "GPU hours", quantity: 10, price: "5.00" },
      { description: "Storage", quantity: 2, price: "12.50" },
    ];
    const totalUsdc = 10 * 5 + 2 * 12.5; // 75

    let insertedPayload: Record<string, unknown> | undefined;
    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.insert = vi.fn((payload: unknown) => {
        insertedPayload = payload as Record<string, unknown>;
        return chain;
      });
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE, line_items: lineItems, amount_usdc: totalUsdc },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await createInvoice(
      "comp-1",
      null,
      "0xSELLER_WALLET",
      "Multi-item invoice",
      lineItems,
      totalUsdc,
    );

    expect(result.amount_usdc).toBe(75);
    expect(insertedPayload?.amount_usdc).toBe(75);
  });
});

/* ================================================================
   VAL-PAY-002: Successful settlement closes the invoice and
   records payment proof
   ================================================================ */

describe("VAL-PAY-002: Successful settlement records payment proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks invoice paid with payer proof, tx hash, and paid timestamp", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    let eqCalls: [string, unknown][] = [];
    let updatePayload: Record<string, unknown> | undefined;

    vi.mocked(supabase.from).mockImplementation(() => {
      eqCalls = [];
      const chain = buildChain();

      // First call: select to fetch the invoice
      chain.select = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE },
        error: null,
      });

      // Second call: update to mark as paid
      chain.update = vi.fn((payload: unknown) => {
        updatePayload = payload as Record<string, unknown>;
        return chain;
      });
      chain.eq = vi.fn((_col: string, _val: unknown) => {
        eqCalls.push([_col, _val]);
        return chain;
      });
      chain.single = vi.fn().mockResolvedValue({
        data: {
          ...UNPAID_INVOICE,
          paid: true,
          tx_hash: "0xTX_HASH_123",
          buyer_wallet: "0xPAYER_WALLET",
          paid_at: "2025-01-02T00:00:00Z",
        },
        error: null,
      });

      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await validateAndSettleInvoice(VALID_PROOF);

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.invoiceId).toBe("inv-settle-1");
    expect(result.amountUsdc).toBe(50);
    expect(result.txHash).toBe("0xTX_HASH_123");
    expect(result.paidAt).toBeDefined();

    // Verify the update includes buyer_wallet, tx_hash, and paid_at
    expect(updatePayload).toMatchObject({
      paid: true,
      tx_hash: "0xTX_HASH_123",
      buyer_wallet: "0xPAYER_WALLET",
    });
    expect(updatePayload?.paid_at).toBeDefined();
  });
});

/* ================================================================
   VAL-PAY-003: Invalid or missing payment proof leaves the
   invoice unpaid
   ================================================================ */

describe("VAL-PAY-003: Invalid proof leaves invoice unpaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when txHash is missing", async () => {
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    const result = await validateAndSettleInvoice({
      ...VALID_PROOF,
      txHash: "",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(402);
    expect(result.error).toContain("Missing payment proof");
  });

  it("rejects when payerWallet is missing", async () => {
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    const result = await validateAndSettleInvoice({
      ...VALID_PROOF,
      payerWallet: "",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(402);
    expect(result.error).toContain("Missing payment proof");
  });

  it("returns 404 when invoice does not exist", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await validateAndSettleInvoice({
      ...VALID_PROOF,
      invoiceId: "nonexistent",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toContain("Invoice not found");
  });

  it("rejects amount mismatch without modifying invoice", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await validateAndSettleInvoice({
      ...VALID_PROOF,
      amountUsdc: 999, // wrong amount
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(422);
    expect(result.error).toContain("Amount mismatch");
    expect(result.error).toContain("999");
    expect(result.error).toContain("50");
  });

  it("rejects chain ID mismatch", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await validateAndSettleInvoice({
      ...VALID_PROOF,
      chainId: 1, // Ethereum mainnet, not Arbitrum
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(422);
    expect(result.error).toContain("Chain mismatch");
  });

  it("rejects recipient wallet mismatch", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await validateAndSettleInvoice({
      ...VALID_PROOF,
      recipientWallet: "0xWRONG_WALLET",
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(422);
    expect(result.error).toContain("Recipient mismatch");
  });
});

/* ================================================================
   VAL-PAY-004: Settlement runs through a server-side x402 surface
   ================================================================ */

describe("VAL-PAY-004: Settlement runs through server-side surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submitSettlement calls supabase.functions.invoke with x402-settle", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        success: true,
        status: 200,
        invoiceId: "inv-1",
        amountUsdc: 50,
        txHash: "0xTX",
        paidAt: "2025-01-02T00:00:00Z",
      },
      error: null,
    });

    const { submitSettlement } = await import("@/lib/x402/settlement-client");

    const result = await submitSettlement(VALID_PROOF);

    // Verify it calls supabase.functions.invoke with the correct function name
    expect(mockFunctionsInvoke).toHaveBeenCalledTimes(1);
    expect(mockFunctionsInvoke).toHaveBeenCalledWith("x402-settle", {
      body: VALID_PROOF,
    });

    expect(result.success).toBe(true);
    expect(result.invoiceId).toBe("inv-1");
    expect(result.txHash).toBe("0xTX");
  });

  it("submitSettlement returns failure on invoke error", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: { message: "Edge function error" },
    });

    const { submitSettlement } = await import("@/lib/x402/settlement-client");

    const result = await submitSettlement(VALID_PROOF);

    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toContain("Settlement request failed");
  });

  it("submitSettlement returns failure on thrown error", async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error("Network error"));

    const { submitSettlement } = await import("@/lib/x402/settlement-client");

    const result = await submitSettlement(VALID_PROOF);

    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toContain("Settlement request failed");
  });
});

/* ================================================================
   VAL-PAY-005: Settlement proof matches invoice economics and
   rejects double payment
   ================================================================ */

describe("VAL-PAY-005: Settlement proof matching and idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("settlement succeeds only when proof matches amount, chain, and recipient", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE },
        error: null,
      });
      chain.update = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({
        data: {
          ...UNPAID_INVOICE,
          paid: true,
          tx_hash: VALID_PROOF.txHash,
          buyer_wallet: VALID_PROOF.payerWallet,
          paid_at: new Date().toISOString(),
        },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    // Valid proof should succeed
    const result = await validateAndSettleInvoice(VALID_PROOF);
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
  });

  it("already-paid invoice cannot be settled twice", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    const paidInvoice = {
      ...UNPAID_INVOICE,
      paid: true,
      tx_hash: "0xPREVIOUS_TX",
      buyer_wallet: "0xPREVIOUS_PAYER",
      paid_at: "2025-01-01T12:00:00Z",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: paidInvoice,
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await validateAndSettleInvoice(VALID_PROOF);

    expect(result.success).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toContain("already paid");
  });

  it("case-insensitive wallet comparison for recipient matching", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE, seller_wallet: "0xAbCdEf" },
        error: null,
      });
      chain.update = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({
        data: {
          ...UNPAID_INVOICE,
          seller_wallet: "0xAbCdEf",
          paid: true,
          tx_hash: VALID_PROOF.txHash,
          buyer_wallet: VALID_PROOF.payerWallet,
          paid_at: new Date().toISOString(),
        },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    // Should succeed with different casing
    const result = await validateAndSettleInvoice({
      ...VALID_PROOF,
      recipientWallet: "0xABCDEF",
    });

    expect(result.success).toBe(true);
  });

  it("optimistic lock prevents race conditions", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { validateAndSettleInvoice } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      // Invoice looks unpaid at fetch time
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { ...UNPAID_INVOICE },
        error: null,
      });
      // But the update fails because another request already paid it
      chain.update = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "No rows returned" },
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await validateAndSettleInvoice(VALID_PROOF);

    expect(result.success).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toContain("race condition");
  });
});

/* ================================================================
   Settlement State Query
   ================================================================ */

describe("getInvoiceSettlementState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns full invoice with settlement data", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getInvoiceSettlementState } = await import("@/lib/x402/settlement");

    const paidInvoice = {
      ...UNPAID_INVOICE,
      paid: true,
      tx_hash: "0xTX123",
      buyer_wallet: "0xBUYER",
      paid_at: "2025-01-02T00:00:00Z",
    };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: paidInvoice,
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getInvoiceSettlementState("inv-settle-1");

    expect(result).toEqual(paidInvoice);
    expect(result?.paid).toBe(true);
    expect(result?.buyer_wallet).toBe("0xBUYER");
    expect(result?.tx_hash).toBe("0xTX123");
  });

  it("returns null when invoice not found", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getInvoiceSettlementState } = await import("@/lib/x402/settlement");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getInvoiceSettlementState("nonexistent");
    expect(result).toBeNull();
  });
});

/* ================================================================
   useSettleInvoice Hook
   ================================================================ */

describe("useSettleInvoice hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls submitSettlement and returns result on success", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        success: true,
        status: 200,
        invoiceId: "inv-1",
        amountUsdc: 50,
        txHash: "0xTX",
        paidAt: "2025-01-02T00:00:00Z",
      },
      error: null,
    });

    const { useSettleInvoice } = await import("@/hooks/useSettlement");

    const { result } = renderHook(() => useSettleInvoice(), { wrapper });

    result.current.mutate(VALID_PROOF);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.success).toBe(true);
    expect(result.current.data?.txHash).toBe("0xTX");
  });

  it("returns error on settlement failure", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: {
        success: false,
        status: 422,
        invoiceId: "inv-1",
        amountUsdc: 50,
        error: "Amount mismatch",
      },
      error: null,
    });

    const { useSettleInvoice } = await import("@/hooks/useSettlement");

    const { result } = renderHook(() => useSettleInvoice(), { wrapper });

    result.current.mutate(VALID_PROOF);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain("Amount mismatch");
  });
});

/* ================================================================
   x402 index re-exports settlement modules
   ================================================================ */

describe("x402 index exports settlement modules", () => {
  it("exports validateAndSettleInvoice function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.validateAndSettleInvoice).toBe("function");
  });

  it("exports getInvoiceSettlementState function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.getInvoiceSettlementState).toBe("function");
  });

  it("exports submitSettlement function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.submitSettlement).toBe("function");
  });
});
