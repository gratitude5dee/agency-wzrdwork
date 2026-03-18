/**
 * Venice Private Cognition — Tests
 *
 * Tests for the VeniceClient, config constants, and type exports.
 *
 * The VeniceClient proxies requests through a Supabase edge function
 * (`venice-proxy`). The edge function forwards to Venice's API and
 * attaches the API key and Venice-specific headers server-side.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VeniceClient } from "@/lib/venice/client";
import {
  VENICE_API_BASE_URL,
  VENICE_DEFAULT_MODEL,
  VENICE_MODELS,
  VENICE_HEADERS,
} from "@/lib/venice/config";
import { TEST_VENICE_PROXY_URL } from "@/test/test-env";
import type {
  ChatMessage,
  VeniceChatCompletionResponse,
} from "@/lib/venice/types";

/* ---------- config.ts ---------- */

describe("Venice config constants", () => {
  it("exports the correct API base URL", () => {
    expect(VENICE_API_BASE_URL).toBe("https://api.venice.ai/api/v1");
  });

  it("exports the correct default model", () => {
    expect(VENICE_DEFAULT_MODEL).toBe("llama-3.3-70b");
  });

  it("exports a non-empty model list with id and label", () => {
    expect(VENICE_MODELS.length).toBeGreaterThan(0);
    for (const m of VENICE_MODELS) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });

  it("includes the default model in the model list", () => {
    const ids = VENICE_MODELS.map((m) => m.id);
    expect(ids).toContain(VENICE_DEFAULT_MODEL);
  });

  it("exports Venice-specific headers with data retention disabled", () => {
    expect(VENICE_HEADERS["Venice-Data-Retention"]).toBe("false");
  });
});

/* ---------- client.ts ---------- */

describe("VeniceClient", () => {
  const mockResponse: VeniceChatCompletionResponse = {
    id: "chatcmpl-abc123",
    object: "chat.completion",
    created: 1700000000,
    model: "llama-3.3-70b",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: "Hello! How can I help?" },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
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

  it("creates a client with default configuration", () => {
    const client = new VeniceClient({ apiKey: "test-key" });
    expect(client.getModel()).toBe(VENICE_DEFAULT_MODEL);
    expect(client.getBaseUrl()).toBe(TEST_VENICE_PROXY_URL);
  });

  it("allows overriding model and base URL", () => {
    const client = new VeniceClient({
      apiKey: "test-key",
      model: "llama-3.1-405b",
      baseUrl: "https://custom.venice.ai/v1",
    });
    expect(client.getModel()).toBe("llama-3.1-405b");
    expect(client.getBaseUrl()).toBe("https://custom.venice.ai/v1");
  });

  it("sends chat completion request to the proxy endpoint", async () => {
    const client = new VeniceClient({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "user", content: "Hello" },
    ];

    await client.chatCompletion(messages);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url] = fetchSpy.mock.calls[0];
    // The client sends to the Supabase edge function proxy, not the direct Venice API
    expect(url).toBe(TEST_VENICE_PROXY_URL);
  });

  it("does not include Authorization header (edge function adds it server-side)", async () => {
    const client = new VeniceClient({ apiKey: "my-secret-key" });
    await client.chatCompletion([{ role: "user", content: "Hi" }]);

    const [, init] = fetchSpy.mock.calls[0];
    // Proxy pattern: API key is handled by the edge function, not the browser client
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("does not include Venice-Data-Retention header (edge function adds it server-side)", async () => {
    const client = new VeniceClient({ apiKey: "test-key" });
    await client.chatCompletion([{ role: "user", content: "Hi" }]);

    const [, init] = fetchSpy.mock.calls[0];
    // Proxy pattern: Venice-specific headers are added by the edge function
    expect(init.headers["Venice-Data-Retention"]).toBeUndefined();
  });

  it("includes Content-Type application/json header", async () => {
    const client = new VeniceClient({ apiKey: "test-key" });
    await client.chatCompletion([{ role: "user", content: "Hi" }]);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("sends the correct request body with model and messages", async () => {
    const client = new VeniceClient({ apiKey: "test-key" });
    const messages: ChatMessage[] = [
      { role: "system", content: "You are helpful." },
      { role: "user", content: "Tell me a joke." },
    ];

    await client.chatCompletion(messages, { temperature: 0.7, max_tokens: 200 });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe("llama-3.3-70b");
    expect(body.messages).toEqual(messages);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(200);
  });

  it("returns the parsed chat completion response", async () => {
    const client = new VeniceClient({ apiKey: "test-key" });
    const result = await client.chatCompletion([
      { role: "user", content: "Hello" },
    ]);

    expect(result.id).toBe("chatcmpl-abc123");
    expect(result.choices[0].message.content).toBe("Hello! How can I help?");
    expect(result.usage.total_tokens).toBe(18);
  });

  it("throws on non-OK response with status code", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    const client = new VeniceClient({ apiKey: "bad-key" });
    await expect(
      client.chatCompletion([{ role: "user", content: "Hi" }]),
    ).rejects.toThrow("Venice API error (401): Unauthorized");
  });

  it("uses POST method for requests", async () => {
    const client = new VeniceClient({ apiKey: "test-key" });
    await client.chatCompletion([{ role: "user", content: "Hi" }]);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init.method).toBe("POST");
  });
});

/* ---------- index.ts re-exports ---------- */

describe("Venice index re-exports", () => {
  it("exports VeniceClient class from the barrel", async () => {
    const mod = await import("@/lib/venice/index");
    expect(mod.VeniceClient).toBeDefined();
    expect(typeof mod.VeniceClient).toBe("function");
  });

  it("exports config constants from the barrel", async () => {
    const mod = await import("@/lib/venice/index");
    expect(mod.VENICE_API_BASE_URL).toBe("https://api.venice.ai/api/v1");
    expect(mod.VENICE_DEFAULT_MODEL).toBe("llama-3.3-70b");
    expect(mod.VENICE_MODELS).toBeDefined();
    expect(mod.VENICE_HEADERS).toBeDefined();
  });
});
