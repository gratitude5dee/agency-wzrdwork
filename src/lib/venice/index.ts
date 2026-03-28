/**
 * Venice Private Cognition — Public API
 *
 * Re-exports the main classes, functions, types, and constants
 * used by the rest of the application.
 */

export { VeniceClient } from "./client";

export {
  VENICE_API_BASE_URL,
  VENICE_DEFAULT_MODEL,
  VENICE_MODELS,
  VENICE_HEADERS,
} from "./config";

export type { VeniceModelId } from "./config";

export type {
  ChatMessage,
  VeniceChatCompletionRequest,
  VeniceChatCompletionResponse,
  ChatCompletionChoice,
  TokenUsage,
  VeniceClientConfig,
} from "./types";

export {
  redactPrivateReasoning,
  redactRunLogExport,
  executeVeniceStep,
  PRIVATE_REASONING_REDACTED,
} from "./private-reasoning";

export type { VeniceStepInput } from "./private-reasoning";

// Venice Live Inference — Real API calls
export {
  executeVeniceLiveStep,
  executeVeniceLiveLoop,
} from "./live-inference";

export type {
  VeniceLiveStepInput,
  VeniceLiveStepResult,
} from "./live-inference";
