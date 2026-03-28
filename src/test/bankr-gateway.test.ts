/**
 * Bankr LLM Gateway — Tests
 *
 * Tests for the BankrGateway, wallet balance functions, and barrel exports.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BankrGateway, BANKR_API_BASE_URL, BANKR_SUPPORTED_MODELS } from "@/lib/bankr/gateway";
import {
  checkWalletBalance,
  estimateInferenceCost,
  MIN_INFERENCE_BALANCE_CUSD,
} from "@/lib/bankr/wallet";
import { TEST_BANKR_PROXY_URL } from "@/test/test-env";
import type { BankrResponse, ChatMessage } from "@/lib/bankr/types";

/* ---------- gateway constants ---------- */

describe("Bankr gateway constants", () => {
  it("exports the correct API base URL", () => {
    expect(BANKR_API_BASE_URL).toBe("https://api.bankr.ai/v1");
  });

  it("exports 20+ supported models", () => {
    expect(BANKR_SUPPORTED_MODELS.length).toBeGreaterThanOrEqual(20);
  });

  it("each model has id, label, and provider", () => {
    for (const model of BANKR_SUPPORTED_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.label).toBeTruthy();
      expect(model.provider).toBeTruthy();
    }
  });

  it("includes models from major providers", () => {
    const providers = BANKR_SUPPORTED_MODELS.map((m) => m.provider);
    expect(providers).toContain("Anthropic");
    expect(providers).toContain("OpenAI");
    expect(providers).toContain("Google");
    expect(providers).toContain("Meta");
    expect(providers).toContain("Mistral");
  });

  it("getSupportedModels returns a copy of the model list", () => {
    const models = BankrGateway.getSupportedModels();
    expect(models).toEqual(BANKR_SUPPORTED_MODELS);
    expect(models).not.toBe(BANKR_SUPPORTED_MODELS); // different reference
  });
});

/* ---------- BankrGateway ---------- */

describe("BankrGateway", () => {
  const mockResponse: BankrResponse = {
    id: "chatcmpl-bankr-123",
    model: "claude-3-opus",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello from Bankr!" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
    created: 1700000000,
  };

  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a gateway with default configuration", () => {
    const gw = new BankrGateway();
    expect(gw.getBaseUrl()).toBe(TEST_BANKR_PROXY_URL);
  });

  it("allows overriding the base URL", () => {
    const gw = new BankrGateway({
      apiKey: "test-key",
      baseUrl: "https://custom.bankr.ai/v1",
    });
    expect(gw.getBaseUrl()).toBe("https://custom.bankr.ai/v1");
  });

  it("uses edge function URL by default", () => {
    const gw = new BankrGateway();
    expect(gw.getBaseUrl()).toBe(TEST_BANKR_PROXY_URL);
  });

  it("sends POST to the proxy endpoint with model and messages", async () => {
    const gw = new BankrGateway({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
    ];

    await gw.routeInference("claude-3-opus", messages);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    // Proxy pattern: client sends to the Supabase edge function, not the direct Bankr API
    expect(url).toBe(TEST_BANKR_PROXY_URL);
    expect(init.method).toBe("POST");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("claude-3-opus");
    expect(body.messages).toEqual(messages);
  });

  it("does not include Authorization header (edge function adds it server-side)", async () => {
    const gw = new BankrGateway({ apiKey: "my-bankr-key" });
    await gw.routeInference("gpt-4o", [{ role: "user", content: "Hi" }]);

    const [, init] = fetchSpy.mock.calls[0];
    // Proxy pattern: API key is handled by the edge function
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("includes Content-Type application/json header", async () => {
    const gw = new BankrGateway({ apiKey: "test-key" });
    await gw.routeInference("gpt-4o", [{ role: "user", content: "Hi" }]);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("passes optional inference options to the request body", async () => {
    const gw = new BankrGateway({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Tell me something." },
    ];

    await gw.routeInference("gemini-1.5-pro", messages, {
      temperature: 0.7,
      max_tokens: 500,
    });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe("gemini-1.5-pro");
    expect(body.messages).toEqual(messages);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(500);
  });

  it("returns the parsed response", async () => {
    const gw = new BankrGateway({ apiKey: "test-key" });
    const result = await gw.routeInference("claude-3-opus", [
      { role: "user", content: "Hello" },
    ]);

    expect(result.id).toBe("chatcmpl-bankr-123");
    expect(result.model).toBe("claude-3-opus");
    expect(result.choices[0].message.content).toBe("Hello from Bankr!");
    expect(result.usage.total_tokens).toBe(17);
  });

  it("throws on non-OK response with status code", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const gw = new BankrGateway({ apiKey: "bad-key" });
    await expect(
      gw.routeInference("gpt-4o", [{ role: "user", content: "Hi" }]),
    ).rejects.toThrow("Bankr Gateway error (401): Unauthorized");
  });

  it("throws on server error", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const gw = new BankrGateway({ apiKey: "test-key" });
    await expect(
      gw.routeInference("llama-3.3-70b", [{ role: "user", content: "Hi" }]),
    ).rejects.toThrow("Bankr Gateway error (500): Internal Server Error");
  });

  it("uses POST method for requests", async () => {
    const gw = new BankrGateway({ apiKey: "test-key" });
    await gw.routeInference("gpt-4o", [{ role: "user", content: "Hi" }]);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBe("POST");
  });
});

/* ---------- wallet.ts ---------- */

describe("Bankr wallet functions", () => {
  describe("checkWalletBalance", () => {
    it("returns sufficient funds when balance exceeds minimum", () => {
      const result = checkWalletBalance("0xABC", "1.0", "0.5");
      expect(result.hasSufficientFunds).toBe(true);
      expect(result.address).toBe("0xABC");
      expect(result.nativeBalance).toBe("1.0");
      expect(result.stablecoinBalance).toBe("0.5");
    });

    it("returns insufficient funds when balance is below minimum", () => {
      const result = checkWalletBalance("0xABC", "0.5", "0.001");
      expect(result.hasSufficientFunds).toBe(false);
    });

    it("returns sufficient funds when balance equals minimum", () => {
      const result = checkWalletBalance("0xABC", "0.5", "0.01");
      expect(result.hasSufficientFunds).toBe(true);
    });

    it("uses custom minimum balance when provided", () => {
      const result = checkWalletBalance("0xABC", "0.5", "0.05", "0.1");
      expect(result.hasSufficientFunds).toBe(false);
    });

    it("returns zero balance as insufficient", () => {
      const result = checkWalletBalance("0xABC", "0", "0");
      expect(result.hasSufficientFunds).toBe(false);
    });
  });

  describe("estimateInferenceCost", () => {
    it("returns higher cost for premium models", () => {
      const cost = parseFloat(estimateInferenceCost("claude-3-opus", 1000));
      expect(cost).toBe(0.03);
    });

    it("returns medium cost for mid-tier models", () => {
      const cost = parseFloat(estimateInferenceCost("claude-3-sonnet", 1000));
      expect(cost).toBe(0.01);
    });

    it("returns lower cost for economy models", () => {
      const cost = parseFloat(estimateInferenceCost("claude-3-haiku", 1000));
      expect(cost).toBe(0.005);
    });

    it("scales with token count", () => {
      const cost1k = parseFloat(estimateInferenceCost("gpt-4o", 1000));
      const cost2k = parseFloat(estimateInferenceCost("gpt-4o", 2000));
      expect(cost2k).toBeCloseTo(cost1k * 2);
    });
  });

  describe("MIN_INFERENCE_BALANCE_CUSD", () => {
    it("is set to 0.01", () => {
      expect(MIN_INFERENCE_BALANCE_CUSD).toBe("0.01");
    });
  });
});

/* ---------- index.ts re-exports ---------- */

describe("Bankr index re-exports", () => {
  it("exports BankrGateway class from the barrel", async () => {
    const mod = await import("@/lib/bankr/index");
    expect(mod.BankrGateway).toBeDefined();
    expect(typeof mod.BankrGateway).toBe("function");
  });

  it("exports BANKR_API_BASE_URL constant", async () => {
    const mod = await import("@/lib/bankr/index");
    expect(mod.BANKR_API_BASE_URL).toBe("https://api.bankr.ai/v1");
  });

  it("exports BANKR_SUPPORTED_MODELS list", async () => {
    const mod = await import("@/lib/bankr/index");
    expect(mod.BANKR_SUPPORTED_MODELS).toBeDefined();
    expect(mod.BANKR_SUPPORTED_MODELS.length).toBeGreaterThanOrEqual(20);
  });

  it("exports wallet functions from the barrel", async () => {
    const mod = await import("@/lib/bankr/index");
    expect(mod.checkWalletBalance).toBeDefined();
    expect(typeof mod.checkWalletBalance).toBe("function");
    expect(mod.estimateInferenceCost).toBeDefined();
    expect(typeof mod.estimateInferenceCost).toBe("function");
  });
});
