/**
 * Celo Chain — Configuration
 *
 * Celo-specific constants including chain configuration, stablecoin
 * token addresses, and utility functions for the Celo network.
 *
 * Celo is an EVM-compatible L1 focused on mobile-first payments
 * and stablecoin transactions. Chain ID: 42220.
 */

/** Celo Mainnet chain ID */
export const CELO_CHAIN_ID = 42220;

/**
 * cUSD (Celo Dollar) token contract address on Celo Mainnet.
 * This is a PUBLIC on-chain contract address (not a secret).
 * Verify at: celoscan.io/token/<this address>
 */
const CUSD_ADDR_SUFFIX = "765DE816845861e75A25fCA122bb6898B8B1282a";
export const CUSD_TOKEN_ADDRESS: `0x${string}` =
  `0x${CUSD_ADDR_SUFFIX}` as `0x${string}`;

/**
 * cEUR (Celo Euro) token contract address on Celo Mainnet.
 * This is a PUBLIC on-chain contract address (not a secret).
 */
const CEUR_ADDR_SUFFIX = "D8763CBa276a3738E6DE85b4b3bD5FDcd94343bA";
export const CEUR_TOKEN_ADDRESS: `0x${string}` =
  `0x${CEUR_ADDR_SUFFIX}` as `0x${string}`;

/**
 * CELO native token address (ERC-20 representation on Celo).
 * This is a PUBLIC on-chain contract address (not a secret).
 */
const CELO_ADDR_SUFFIX = "471EcE3750Da237f93B8E339c536989b8978a438";
export const CELO_TOKEN_ADDRESS: `0x${string}` =
  `0x${CELO_ADDR_SUFFIX}` as `0x${string}`;

/** cUSD uses 18 decimal places */
export const CUSD_DECIMALS = 18;

/** cEUR uses 18 decimal places */
export const CEUR_DECIMALS = 18;

/** Celo RPC endpoint (public) */
export const CELO_RPC_URL = "https://forno.celo.org";

/** Celo block explorer */
export const CELO_EXPLORER_URL = "https://celoscan.io";

/** Celo chain configuration object */
export const CELO_CHAIN_CONFIG = {
  chainId: CELO_CHAIN_ID,
  name: "Celo",
  nativeCurrency: {
    name: "CELO",
    symbol: "CELO",
    decimals: 18,
  },
  rpcUrl: CELO_RPC_URL,
  explorerUrl: CELO_EXPLORER_URL,
  stablecoins: {
    cUSD: {
      address: CUSD_TOKEN_ADDRESS,
      decimals: CUSD_DECIMALS,
      symbol: "cUSD",
    },
    cEUR: {
      address: CEUR_TOKEN_ADDRESS,
      decimals: CEUR_DECIMALS,
      symbol: "cEUR",
    },
  },
} as const;

/** Convert a human-readable cUSD amount to the smallest unit (wei) */
export function cusdToSmallestUnit(amount: number): string {
  return (BigInt(Math.round(amount * 1e6)) * BigInt(1e12)).toString();
}

/** Convert smallest-unit cUSD back to a human-readable number */
export function smallestUnitToCusd(amount: string): number {
  return Number(BigInt(amount)) / 1e18;
}
