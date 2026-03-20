/**
 * Bankr LLM Gateway — Wallet Balance
 *
 * Functions for checking wallet balance to determine if there
 * are sufficient funds for inference operations.
 */

import type { WalletBalance } from "./types";

/** Minimum cUSD balance required for a single inference call */
export const MIN_INFERENCE_BALANCE_CUSD = "0.01";

/**
 * Check whether a wallet has sufficient balance for inference funding.
 *
 * Reads on-chain balance data for the given wallet address and evaluates
 * whether the stablecoin (cUSD) balance meets the minimum threshold
 * for inference operations.
 *
 * @param walletAddress  - The wallet address to check
 * @param nativeBalance  - Native token balance (e.g. CELO) as a string
 * @param stablecoinBalance - Stablecoin balance (e.g. cUSD) as a string
 * @param minBalance     - Minimum required stablecoin balance (defaults to MIN_INFERENCE_BALANCE_CUSD)
 * @returns WalletBalance with funding sufficiency flag
 */
export function checkWalletBalance(
  walletAddress: string,
  nativeBalance: string,
  stablecoinBalance: string,
  minBalance: string = MIN_INFERENCE_BALANCE_CUSD,
): WalletBalance {
  const hasSufficientFunds =
    parseFloat(stablecoinBalance) >= parseFloat(minBalance);

  return {
    address: walletAddress,
    nativeBalance,
    stablecoinBalance,
    hasSufficientFunds,
  };
}

/**
 * Estimate the cost of an inference request in cUSD.
 *
 * Provides a rough cost estimate based on model and expected token count.
 * Actual cost is determined by the Bankr Gateway at inference time.
 *
 * @param model          - Model identifier
 * @param estimatedTokens - Estimated total tokens (input + output)
 * @returns Estimated cost in cUSD as a string
 */
export function estimateInferenceCost(
  model: string,
  estimatedTokens: number,
): string {
  // Rough pricing tiers per 1K tokens (in cUSD)
  const premiumModels = ["claude-3-opus", "gpt-4o", "gpt-4-turbo", "gemini-1.5-pro"];
  const midModels = ["claude-3-sonnet", "gpt-4o-mini", "llama-3.1-405b", "mistral-large"];

  let costPer1k: number;
  if (premiumModels.includes(model)) {
    costPer1k = 0.03;
  } else if (midModels.includes(model)) {
    costPer1k = 0.01;
  } else {
    costPer1k = 0.005;
  }

  const cost = (estimatedTokens / 1000) * costPer1k;
  return cost.toFixed(6);
}
