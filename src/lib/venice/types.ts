/**
 * Venice Private Cognition — Types
 *
 * TypeScript types matching the OpenAI chat completion format
 * used by Venice's OpenAI-compatible API endpoint.
 */

/** A single message in the chat completion request */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
}

/** Options for a Venice chat completion request */
export interface VeniceChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  /** Sampling temperature (0–2). Higher = more random. */
  temperature?: number;
  /** Nucleus sampling. Top-p probability mass to consider. */
  top_p?: number;
  /** Maximum number of tokens to generate. */
  max_tokens?: number;
  /** Stop sequences. Generation stops when one of these is produced. */
  stop?: string | string[];
  /** Whether to stream the response. */
  stream?: boolean;
  /** Penalise repeated tokens (−2.0 to 2.0). */
  frequency_penalty?: number;
  /** Penalise tokens already present in the prompt (−2.0 to 2.0). */
  presence_penalty?: number;
}

/** Token usage statistics in the response */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** A single completion choice */
export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: "stop" | "length" | "function_call" | "content_filter" | null;
}

/** Venice chat completion response (OpenAI-compatible) */
export interface VeniceChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: TokenUsage;
}

/** Configuration passed to the VeniceClient constructor */
export interface VeniceClientConfig {
  /** Venice API key. Defaults to VITE_VENICE_API_KEY env var. */
  apiKey?: string;
  /** Model to use. Defaults to VENICE_DEFAULT_MODEL from config. */
  model?: string;
  /** Base URL for the Venice API. Defaults to VENICE_API_BASE_URL. */
  baseUrl?: string;
}
