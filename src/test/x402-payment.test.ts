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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => buildChain()),
  },
}));

/* ---------- thirdweb mocks ---------- */

vi.mock("thirdweb/x402", () => ({
  settlePayment: vi.fn(),
  facilitator: vi.fn(() => ({
    url: "https://facilitator.thirdweb.com",
    address: "0xFACILITATOR",
    createAuthHeaders: vi.fn(),
    verify: vi.fn(),
    settle: vi.fn(),
    supported: vi.fn(),
    accepts: vi.fn(),
  })),
}));

vi.mock("thirdweb", () => ({
  createThirdwebClient: vi.fn(() => ({ clientId: "mock-client" })),
}));

vi.mock("thirdweb/chains", () => ({
  arbitrum: { id: 42161, name: "Arbitrum One" },
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

/* ================================================================
   Constants
   ================================================================ */

describe("x402 Constants", () => {
  it("USDC address is correct on Arbitrum", async () => {
    const { USDC_TOKEN_ADDRESS } = await import("@/lib/x402/constants");
    // Public Arbitrum USDC contract address (not a secret)
    expect(USDC_TOKEN_ADDRESS).toMatch(/^0xaf88d065e77c8cC/);
  });

  it("USDC decimals is 6", async () => {
    const { USDC_DECIMALS } = await import("@/lib/x402/constants");
    expect(USDC_DECIMALS).toBe(6);
  });

  it("Arbitrum chain ID is 42161", async () => {
    const { ARBITRUM_CHAIN_ID } = await import("@/lib/x402/constants");
    expect(ARBITRUM_CHAIN_ID).toBe(42161);
  });

  it("usdcToSmallestUnit converts correctly", async () => {
    const { usdcToSmallestUnit } = await import("@/lib/x402/constants");
    expect(usdcToSmallestUnit(1)).toBe("1000000");
    expect(usdcToSmallestUnit(0.5)).toBe("500000");
    expect(usdcToSmallestUnit(100.25)).toBe("100250000");
  });

  it("smallestUnitToUsdc converts correctly", async () => {
    const { smallestUnitToUsdc } = await import("@/lib/x402/constants");
    expect(smallestUnitToUsdc("1000000")).toBe(1);
    expect(smallestUnitToUsdc("500000")).toBe(0.5);
    expect(smallestUnitToUsdc("100250000")).toBe(100.25);
  });
});

/* ================================================================
   Types
   ================================================================ */

describe("x402 Types", () => {
  it("Invoice type has all required fields", () => {
    const invoice: import("@/lib/x402/types").Invoice = {
      id: "inv-1",
      company_id: "comp-1",
      agent_id: "agent-1",
      seller_wallet: "0xSELLER",
      buyer_wallet: null,
      description: "Test invoice",
      line_items: [{ description: "Item 1", quantity: 1, price: "10.00" }],
      amount_usdc: 10,
      paid: false,
      tx_hash: null,
      chain_id: 42161,
      created_at: "2025-01-01",
      paid_at: null,
    };
    expect(invoice.id).toBe("inv-1");
    expect(invoice.line_items).toHaveLength(1);
    expect(invoice.chain_id).toBe(42161);
  });

  it("LineItem type has description, quantity, price", () => {
    const item: import("@/lib/x402/types").LineItem = {
      description: "Agent compute",
      quantity: 5,
      price: "2.50",
    };
    expect(item.description).toBe("Agent compute");
    expect(item.quantity).toBe(5);
    expect(item.price).toBe("2.50");
  });

  it("PaymentResult type has success, status, txHash, invoiceId, amountUsdc", () => {
    const result: import("@/lib/x402/types").PaymentResult = {
      success: true,
      status: 200,
      txHash: "0xTX",
      invoiceId: "inv-1",
      amountUsdc: 10,
    };
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.txHash).toBe("0xTX");
  });
});

/* ================================================================
   createInvoice
   ================================================================ */

describe("createInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts row into agent_invoices with all fields", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { createInvoice } = await import("@/lib/x402/invoices");

    const mockRow = {
      id: "inv-1",
      company_id: "comp-1",
      agent_id: "agent-1",
      seller_wallet: "0xSELLER",
      buyer_wallet: null,
      description: "Compute services",
      line_items: [{ description: "GPU hours", quantity: 10, price: "5.00" }],
      amount_usdc: 50,
      paid: false,
      tx_hash: null,
      chain_id: 42161,
      created_at: "2025-01-01T00:00:00Z",
      paid_at: null,
    };

    let insertedPayload: unknown;
    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.insert = vi.fn((payload: unknown) => {
        insertedPayload = payload;
        return chain;
      });
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({ data: mockRow, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await createInvoice(
      "comp-1",
      "agent-1",
      "0xSELLER",
      "Compute services",
      [{ description: "GPU hours", quantity: 10, price: "5.00" }],
      50,
    );

    expect(supabase.from).toHaveBeenCalledWith("agent_invoices");
    expect(result).toEqual(mockRow);
    expect(insertedPayload).toMatchObject({
      company_id: "comp-1",
      agent_id: "agent-1",
      seller_wallet: "0xSELLER",
      description: "Compute services",
      amount_usdc: 50,
      paid: false,
      tx_hash: null,
      chain_id: 42161,
    });
  });

  it("throws on Supabase error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { createInvoice } = await import("@/lib/x402/invoices");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.insert = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "insert failed" } });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(
      createInvoice("comp-1", null, "0xSELLER", "Test", [], 10),
    ).rejects.toThrow("Failed to create invoice");
  });
});

/* ================================================================
   getInvoice
   ================================================================ */

describe("getInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invoice by ID", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getInvoice } = await import("@/lib/x402/invoices");

    const mockInvoice = { id: "inv-1", amount_usdc: 10 };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockInvoice, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getInvoice("inv-1");
    expect(result).toEqual(mockInvoice);
    expect(supabase.from).toHaveBeenCalledWith("agent_invoices");
  });

  it("returns null when not found", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getInvoice } = await import("@/lib/x402/invoices");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await getInvoice("nonexistent");
    expect(result).toBeNull();
  });

  it("throws on Supabase error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { getInvoice } = await import("@/lib/x402/invoices");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "db error" } });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(getInvoice("inv-1")).rejects.toThrow("Failed to fetch invoice");
  });
});

/* ================================================================
   listInvoices
   ================================================================ */

describe("listInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invoices for company sorted by created_at desc", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { listInvoices } = await import("@/lib/x402/invoices");

    const mockInvoices = [
      { id: "inv-2", created_at: "2025-01-02" },
      { id: "inv-1", created_at: "2025-01-01" },
    ];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn().mockResolvedValue({ data: mockInvoices, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await listInvoices("comp-1");
    expect(result).toEqual(mockInvoices);
    expect(supabase.from).toHaveBeenCalledWith("agent_invoices");
  });

  it("returns empty array when no invoices", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { listInvoices } = await import("@/lib/x402/invoices");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await listInvoices("comp-empty");
    expect(result).toEqual([]);
  });

  it("throws on Supabase error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { listInvoices } = await import("@/lib/x402/invoices");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn().mockResolvedValue({ data: null, error: { message: "query error" } });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(listInvoices("comp-1")).rejects.toThrow("Failed to list invoices");
  });
});

/* ================================================================
   updateInvoicePayment
   ================================================================ */

describe("updateInvoicePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates paid status and tx_hash", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { updateInvoicePayment } = await import("@/lib/x402/invoices");

    const mockUpdated = {
      id: "inv-1",
      paid: true,
      tx_hash: "0xTX123",
      paid_at: "2025-01-01T12:00:00Z",
    };

    let updatedPayload: unknown;
    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.update = vi.fn((payload: unknown) => {
        updatedPayload = payload;
        return chain;
      });
      chain.eq = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({ data: mockUpdated, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await updateInvoicePayment("inv-1", "0xTX123");

    expect(supabase.from).toHaveBeenCalledWith("agent_invoices");
    expect(result).toEqual(mockUpdated);
    expect(updatedPayload).toMatchObject({
      paid: true,
      tx_hash: "0xTX123",
    });
  });

  it("throws on Supabase error", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { updateInvoicePayment } = await import("@/lib/x402/invoices");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.update = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.select = vi.fn(() => chain);
      chain.single = vi.fn().mockResolvedValue({ data: null, error: { message: "update failed" } });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    await expect(updateInvoicePayment("inv-1", "0xTX")).rejects.toThrow("Failed to update invoice payment");
  });
});

/* ================================================================
   settleInvoicePayment (payment.ts)
   ================================================================ */

describe("settleInvoicePayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is wired to thirdweb x402 with Arbitrum USDC config", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { settlePayment: mockSettle } = await import("thirdweb/x402");
    const { settleInvoicePayment } = await import("@/lib/x402/payment");
    const { USDC_TOKEN_ADDRESS } = await import("@/lib/x402/constants");

    // Mock getInvoice → returns unpaid invoice
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const chain = buildChain();
      if (table === "agent_invoices") {
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.maybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: "inv-1",
            seller_wallet: "0xSELLER",
            amount_usdc: 25,
            paid: false,
          },
          error: null,
        });
        // For updateInvoicePayment
        chain.update = vi.fn(() => chain);
        chain.single = vi.fn().mockResolvedValue({
          data: { id: "inv-1", paid: true, tx_hash: "0xSETTLED" },
          error: null,
        });
      }
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    // Mock settlePayment to return success
    vi.mocked(mockSettle).mockResolvedValue({
      status: 200,
      responseHeaders: {},
      paymentReceipt: { txHash: "0xSETTLED" } as never,
    });

    const result = await settleInvoicePayment(
      "inv-1",
      "payment-data-header",
      "https://api.example.com/pay",
      "secret-key",
      "0xSERVER",
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.invoiceId).toBe("inv-1");
    expect(result.amountUsdc).toBe(25);

    // Verify settlePayment was called with Arbitrum USDC config
    expect(mockSettle).toHaveBeenCalledWith(
      expect.objectContaining({
        network: { id: 42161, name: "Arbitrum One" },
        price: {
          amount: "25000000", // 25 USDC in smallest unit
          asset: {
            address: USDC_TOKEN_ADDRESS,
            decimals: 6,
          },
        },
        payTo: "0xSELLER",
      }),
    );
  });

  it("returns error when invoice not found", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { settleInvoicePayment } = await import("@/lib/x402/payment");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await settleInvoicePayment(
      "nonexistent",
      undefined,
      "https://example.com",
      "key",
      "0xSERVER",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toContain("not found");
  });

  it("returns error when invoice already paid", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { settleInvoicePayment } = await import("@/lib/x402/payment");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { id: "inv-1", paid: true, amount_usdc: 10 },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await settleInvoicePayment(
      "inv-1",
      undefined,
      "https://example.com",
      "key",
      "0xSERVER",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toContain("already paid");
  });

  it("returns 402 when payment proof is missing/invalid", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { settlePayment: mockSettle } = await import("thirdweb/x402");
    const { settleInvoicePayment } = await import("@/lib/x402/payment");

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { id: "inv-1", seller_wallet: "0xSELLER", amount_usdc: 10, paid: false },
        error: null,
      });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    vi.mocked(mockSettle).mockResolvedValue({
      status: 402,
      responseHeaders: {},
      responseBody: { x402Version: 1, error: "payment_required", accepts: [] },
    } as never);

    const result = await settleInvoicePayment(
      "inv-1",
      undefined,
      "https://example.com",
      "key",
      "0xSERVER",
    );

    expect(result.success).toBe(false);
    expect(result.status).toBe(402);
    expect(result.error).toContain("Payment required");
  });
});

/* ================================================================
   useInvoices Hook
   ================================================================ */

describe("useInvoice hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when invoiceId is undefined", async () => {
    const { useInvoice } = await import("@/hooks/useInvoices");

    const { result } = renderHook(() => useInvoice(undefined), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it("queries single invoice by ID", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { useInvoice } = await import("@/hooks/useInvoices");

    const mockInvoice = { id: "inv-1", amount_usdc: 42 };

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: mockInvoice, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const { result } = renderHook(() => useInvoice("inv-1"), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockInvoice);
    });
  });
});

describe("useInvoices hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns undefined when companyId is undefined", async () => {
    const { useInvoices } = await import("@/hooks/useInvoices");

    const { result } = renderHook(() => useInvoices(undefined), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isFetching).toBe(false);
  });

  it("queries invoices for a company", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { useInvoices } = await import("@/hooks/useInvoices");

    const mockInvoices = [{ id: "inv-1" }, { id: "inv-2" }];

    vi.mocked(supabase.from).mockImplementation(() => {
      const chain = buildChain();
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn().mockResolvedValue({ data: mockInvoices, error: null });
      return chain as unknown as ReturnType<typeof supabase.from>;
    });

    const { result } = renderHook(() => useInvoices("comp-1"), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(mockInvoices);
    });
  });
});

/* ================================================================
   Index re-exports
   ================================================================ */

describe("x402 index exports", () => {
  it("exports createInvoice function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.createInvoice).toBe("function");
  });

  it("exports getInvoice function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.getInvoice).toBe("function");
  });

  it("exports listInvoices function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.listInvoices).toBe("function");
  });

  it("exports updateInvoicePayment function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.updateInvoicePayment).toBe("function");
  });

  it("exports settleInvoicePayment function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.settleInvoicePayment).toBe("function");
  });

  it("exports createX402Facilitator function", async () => {
    const mod = await import("@/lib/x402/index");
    expect(typeof mod.createX402Facilitator).toBe("function");
  });

  it("exports USDC_TOKEN_ADDRESS constant", async () => {
    const mod = await import("@/lib/x402/index");
    // Public Arbitrum USDC contract address (not a secret)
    expect(mod.USDC_TOKEN_ADDRESS).toMatch(/^0xaf88d065e77c8cC/);
  });

  it("exports ARBITRUM_CHAIN_ID constant", async () => {
    const mod = await import("@/lib/x402/index");
    expect(mod.ARBITRUM_CHAIN_ID).toBe(42161);
  });
});
