/**
 * Bankr LLM Gateway — Client
 *
 * BankrGateway now proxies requests through a Supabase edge function
 * so the API key never leaves the server.
 */

import type {
  BankrGatewayConfig,
  BankrRequest,
  BankrResponse,
  ChatMessage,
  InferenceOptions,
  ModelInfo,
} from "./types";

/** Edge function URL */
const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bankr-proxy`;

/** Kept for reference / UI dropdowns */
export const BANKR_API_BASE_URL = "https://api.bankr.ai/v1";

export const BANKR_SUPPORTED_MODELS: ModelInfo[] = [
  { id: "claude-3-opus", label: "Claude 3 Opus", provider: "Anthropic" },
  { id: "claude-3-sonnet", label: "Claude 3 Sonnet", provider: "Anthropic" },
  { id: "claude-3-haiku", label: "Claude 3 Haiku", provider: "Anthropic" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "Google" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "Google" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "Google" },
  { id: "llama-3.1-405b", label: "Llama 3.1 405B", provider: "Meta" },
  { id: "llama-3.1-70b", label: "Llama 3.1 70B", provider: "Meta" },
  { id: "llama-3.3-70b", label: "Llama 3.3 70B", provider: "Meta" },
  { id: "mistral-large", label: "Mistral Large", provider: "Mistral" },
  { id: "mistral-medium", label: "Mistral Medium", provider: "Mistral" },
  { id: "mixtral-8x7b", label: "Mixtral 8x7B", provider: "Mistral" },
  { id: "command-r-plus", label: "Command R+", provider: "Cohere" },
  { id: "command-r", label: "Command R", provider: "Cohere" },
  { id: "deepseek-v3", label: "DeepSeek V3", provider: "DeepSeek" },
  { id: "deepseek-r1", label: "DeepSeek R1", provider: "DeepSeek" },
  { id: "qwen-2.5-72b", label: "Qwen 2.5 72B", provider: "Alibaba" },
  { id: "yi-large", label: "Yi Large", provider: "01.AI" },
] as const;

export class BankrGateway {
  private readonly baseUrl: string;

  constructor(config: BankrGatewayConfig = {}) {
    this.baseUrl = config.baseUrl ?? EDGE_FUNCTION_URL;
  }

  async routeInference(
    model: string,
    messages: ChatMessage[],
    options?: InferenceOptions,
  ): Promise<BankrResponse> {
    const body: BankrRequest = {
      model,
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
        `Bankr Gateway error (${response.status}): ${errorText}`,
      );
    }

    return response.json() as Promise<BankrResponse>;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  static getSupportedModels(): ModelInfo[] {
    return [...BANKR_SUPPORTED_MODELS];
  }
}
