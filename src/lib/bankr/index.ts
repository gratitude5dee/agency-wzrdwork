/**
 * Bankr LLM Gateway — Public API
 *
 * Re-exports the main classes, functions, types, and constants
 * used by the rest of the application.
 */

export { BankrGateway, BANKR_API_BASE_URL, BANKR_SUPPORTED_MODELS } from "./gateway";

export {
  checkWalletBalance,
  estimateInferenceCost,
  MIN_INFERENCE_BALANCE_CUSD,
} from "./wallet";

export { loadBankrConfig, saveBankrConfig } from "./config";
export type { BankrConfig } from "./config";

export { executeBankrInference } from "./inference-flow";
export type { BankrInferenceInput, BankrInferenceResult } from "./inference-flow";

export type {
  ChatMessage,
  ModelInfo,
  BankrRequest,
  BankrResponse,
  BankrTokenUsage,
  BankrChoice,
  BankrGatewayConfig,
  InferenceOptions,
  WalletBalance,
} from "./types";

// Bankr Signals — Provider registration & signal publishing
export {
  registerSignalProvider,
  publishSignal,
  closeSignal,
  getSignalFeed,
  getLeaderboard,
  getProviderSignals,
  getBankrWalletAddress,
  checkHealth as checkBankrSignalsHealth,
} from "./signals";

export type {
  RegisterProviderInput,
  RegisterProviderResult,
  PublishSignalInput,
  PublishSignalResult,
  CloseSignalInput,
  CloseSignalResult,
  SignalFeedEntry,
  LeaderboardEntry,
  SignalAction,
  SignalStatus,
} from "./signals";
