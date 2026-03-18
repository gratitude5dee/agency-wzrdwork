/**
 * Celo Chain — Public API
 *
 * Re-exports the main functions, types, and constants
 * used by the rest of the application.
 */

export {
  CELO_CHAIN_ID,
  CUSD_TOKEN_ADDRESS,
  CEUR_TOKEN_ADDRESS,
  CELO_TOKEN_ADDRESS,
  CUSD_DECIMALS,
  CEUR_DECIMALS,
  CELO_RPC_URL,
  CELO_EXPLORER_URL,
  CELO_CHAIN_CONFIG,
  cusdToSmallestUnit,
  smallestUnitToCusd,
} from "./config";

export { loadCeloConfig, saveCeloConfig } from "./integration-config";
export type { CeloConfig, CeloNetwork, CeloStablecoin } from "./integration-config";

export { executeCeloPayment } from "./payment-flow";
export type { CeloPaymentInput, CeloPaymentResult } from "./payment-flow";
