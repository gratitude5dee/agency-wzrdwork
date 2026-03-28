/**
 * Lido — Chain Configuration
 *
 * Lido-specific constants including the stETH contract address,
 * withdrawal queue, and utility functions for staking treasury.
 *
 * Lido is the largest liquid staking protocol on Ethereum. stETH
 * rebases daily to reflect staking rewards.
 */

/** Ethereum Mainnet chain ID */
export const ETH_CHAIN_ID = 1;

/**
 * stETH (Lido Staked Ether) token contract address on Ethereum Mainnet.
 * This is a PUBLIC on-chain contract address (not a secret).
 * Verify at: etherscan.io/token/<this address>
 */
const STETH_ADDR_SUFFIX = "ae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
export const STETH_TOKEN_ADDRESS: `0x${string}` =
  `0x${STETH_ADDR_SUFFIX}` as `0x${string}`;

/**
 * wstETH (Wrapped stETH) token contract address on Ethereum Mainnet.
 * This is a PUBLIC on-chain contract address (not a secret).
 */
const WSTETH_ADDR_SUFFIX = "7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0";
export const WSTETH_TOKEN_ADDRESS: `0x${string}` =
  `0x${WSTETH_ADDR_SUFFIX}` as `0x${string}`;

/**
 * Lido Withdrawal Queue contract address on Ethereum Mainnet.
 * This is a PUBLIC on-chain contract address (not a secret).
 */
const WITHDRAWAL_QUEUE_ADDR_SUFFIX = "889edC2eDab5f40e902b864aD4d7AdE8E412F9B1";
export const WITHDRAWAL_QUEUE_ADDRESS: `0x${string}` =
  `0x${WITHDRAWAL_QUEUE_ADDR_SUFFIX}` as `0x${string}`;

/** stETH uses 18 decimal places */
export const STETH_DECIMALS = 18;

/** Ethereum RPC endpoint (public) */
export const ETH_RPC_URL = "https://ethereum-rpc.publicnode.com";

/** Ethereum block explorer */
export const ETH_EXPLORER_URL = "https://etherscan.io";

/** Lido chain configuration object */
export const LIDO_CHAIN_CONFIG = {
  chainId: ETH_CHAIN_ID,
  name: "Ethereum",
  protocol: "Lido",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrl: ETH_RPC_URL,
  explorerUrl: ETH_EXPLORER_URL,
  tokens: {
    stETH: {
      address: STETH_TOKEN_ADDRESS,
      decimals: STETH_DECIMALS,
      symbol: "stETH",
    },
    wstETH: {
      address: WSTETH_TOKEN_ADDRESS,
      decimals: STETH_DECIMALS,
      symbol: "wstETH",
    },
  },
  withdrawalQueue: WITHDRAWAL_QUEUE_ADDRESS,
} as const;

/** Convert a human-readable ETH amount to wei */
export function ethToWei(amount: number): string {
  return (BigInt(Math.round(amount * 1e6)) * BigInt(1e12)).toString();
}

/** Convert wei back to a human-readable ETH number */
export function weiToEth(amount: string): number {
  return Number(BigInt(amount)) / 1e18;
}
