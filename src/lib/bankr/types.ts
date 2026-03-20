/**
 * Bankr LLM Gateway — Types
 *
 * TypeScript types for the Bankr LLM Gateway API which provides
 * a single endpoint to route inference requests to 20+ models
 * (Claude, Gemini, GPT, Llama, etc.).
 */

/** A single message in a chat inference request */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Information about a supported model */
export interface ModelInfo {
  /** Model identifier (e.g. "claude-3-opus", "gpt-4o", "gemini-pro") */
  id: string;
  /** Human-readable display label */
  label: string;
  /** Provider name (e.g. "Anthropic", "OpenAI", "Google") */
  provider: string;
}

/** Request payload for the Bankr inference API */
export interface BankrRequest {
  /** Target model identifier */
  model: string;
  /** Chat messages */
  messages: ChatMessage[];
  /** Sampling temperature (0–2). Higher = more random. */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Stop sequences */
  stop?: string | string[];
}

/** Token usage statistics */
export interface BankrTokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** A single completion choice */
export interface BankrChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "content_filter" | null;
}

/** Response from the Bankr inference API */
export interface BankrResponse {
  id: string;
  model: string;
  choices: BankrChoice[];
  usage: BankrTokenUsage;
  created: number;
}

/** Configuration passed to the BankrGateway constructor */
export interface BankrGatewayConfig {
  /** Bankr API key. Defaults to VITE_BANKR_API_KEY env var. */
  apiKey?: string;
  /** Base URL for the Bankr Gateway API. Defaults to BANKR_API_BASE_URL. */
  baseUrl?: string;
}

/** Options for the routeInference method */
export interface InferenceOptions {
  /** Sampling temperature (0–2) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Stop sequences */
  stop?: string | string[];
}

/** Wallet balance information for inference funding */
export interface WalletBalance {
  /** Wallet address */
  address: string;
  /** Balance in the native token (e.g. CELO) */
  nativeBalance: string;
  /** Balance in stablecoin (e.g. cUSD) */
  stablecoinBalance: string;
  /** Whether the wallet has sufficient funds for inference */
  hasSufficientFunds: boolean;
}
