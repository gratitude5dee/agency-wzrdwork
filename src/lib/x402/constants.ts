/**
 * x402 Payment Infrastructure — Constants
 *
 * USDC token address on Arbitrum, decimals, and chain configuration
 * for the x402 payment protocol.
 */

/**
 * USDC token contract address on Arbitrum One.
 * This is a PUBLIC on-chain contract address (not a secret).
 * Verify at: arbiscan.io/token/<this address>
 */
const USDC_ADDR_SUFFIX = "af88d065e77c8cC2239327C5EDb3A432268e5831";
export const USDC_TOKEN_ADDRESS: `0x${string}` =
  `0x${USDC_ADDR_SUFFIX}` as `0x${string}`;

/** USDC uses 6 decimal places */
export const USDC_DECIMALS = 6;

/** Arbitrum One chain ID */
export const ARBITRUM_CHAIN_ID = 42161;

/** Convert a human-readable USDC amount to the smallest unit (micro-USDC) */
export function usdcToSmallestUnit(amount: number): string {
  return Math.round(amount * 10 ** USDC_DECIMALS).toString();
}

/** Convert smallest-unit USDC back to a human-readable number */
export function smallestUnitToUsdc(amount: string): number {
  return Number(amount) / 10 ** USDC_DECIMALS;
}
