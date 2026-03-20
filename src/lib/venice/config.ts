/**
 * Venice Private Cognition — Configuration
 *
 * Constants, model list, and default settings for the Venice
 * private AI integration.
 */

/** Base URL for the Venice OpenAI-compatible API */
export const VENICE_API_BASE_URL = "https://api.venice.ai/api/v1";

/** Default model used when none is specified */
export const VENICE_DEFAULT_MODEL = "llama-3.3-70b";

/** Available Venice models with display labels */
export const VENICE_MODELS = [
  { id: "llama-3.3-70b", label: "Llama 3.3 70B" },
  { id: "llama-3.1-405b", label: "Llama 3.1 405B" },
  { id: "deepseek-r1-671b", label: "DeepSeek R1 671B" },
  { id: "qwen-2.5-vl", label: "Qwen 2.5 VL" },
  { id: "qwen-2.5-coder", label: "Qwen 2.5 Coder" },
] as const;

/** All available model IDs as a union type */
export type VeniceModelId = (typeof VENICE_MODELS)[number]["id"];

/**
 * Venice-specific request headers.
 * - `Venice-Data-Retention`: "false" disables data retention on Venice servers,
 *   ensuring that prompts and completions are never stored or used for training.
 */
export const VENICE_HEADERS = {
  "Venice-Data-Retention": "false",
} as const;
