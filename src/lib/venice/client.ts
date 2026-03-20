/**
 * Venice Private Cognition — Client
 *
 * VeniceClient now proxies requests through a Supabase edge function
 * so the API key never leaves the server.
 */

import { VENICE_DEFAULT_MODEL } from "./config";
import type {
  ChatMessage,
  VeniceChatCompletionRequest,
  VeniceChatCompletionResponse,
  VeniceClientConfig,
} from "./types";

/** Build the edge function URL from the Supabase project ID */
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/venice-proxy`;

export class VeniceClient {
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: VeniceClientConfig = {}) {
    this.model = config.model ?? VENICE_DEFAULT_MODEL;
    this.baseUrl = config.baseUrl ?? EDGE_FUNCTION_URL;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options: Partial<
      Omit<VeniceChatCompletionRequest, "messages" | "model">
    > = {},
  ): Promise<VeniceChatCompletionResponse> {
    const body: VeniceChatCompletionRequest = {
      model: this.model,
      messages,
      ...options,
    };

    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Venice API error (${response.status}): ${errorText}`,
      );
    }

    return response.json() as Promise<VeniceChatCompletionResponse>;
  }

  getModel(): string {
    return this.model;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
