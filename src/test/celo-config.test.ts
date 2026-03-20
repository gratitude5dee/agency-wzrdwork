/**
 * Celo Chain Configuration — Tests
 *
 * Tests for the Celo chain configuration, constants, and utility functions.
 * Also verifies that the thirdweb provider supports Celo alongside Arbitrum.
 */

import { describe, it, expect } from "vitest";
import {
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
} from "@/lib/celo/config";

/* ---------- constants ---------- */

describe("Celo chain constants", () => {
  it("exports the correct chain ID (42220)", () => {
    expect(CELO_CHAIN_ID).toBe(42220);
  });

  it("exports cUSD token address as a 0x-prefixed string", () => {
    expect(CUSD_TOKEN_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(CUSD_TOKEN_ADDRESS.toLowerCase()).toBe(
      "0x765de816845861e75a25fca122bb6898b8b1282a",
    );
  });

  it("exports cEUR token address as a 0x-prefixed string", () => {
    expect(CEUR_TOKEN_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(CEUR_TOKEN_ADDRESS.toLowerCase()).toBe(
      "0xd8763cba276a3738e6de85b4b3bd5fdcd94343ba",
    );
  });

  it("exports CELO token address as a 0x-prefixed string", () => {
    expect(CELO_TOKEN_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("cUSD uses 18 decimals", () => {
    expect(CUSD_DECIMALS).toBe(18);
  });

  it("cEUR uses 18 decimals", () => {
    expect(CEUR_DECIMALS).toBe(18);
  });

  it("exports a valid RPC URL", () => {
    expect(CELO_RPC_URL).toBe("https://forno.celo.org");
  });

  it("exports a valid explorer URL", () => {
    expect(CELO_EXPLORER_URL).toBe("https://celoscan.io");
  });
});

/* ---------- chain config object ---------- */

describe("CELO_CHAIN_CONFIG", () => {
  it("has the correct chain ID", () => {
    expect(CELO_CHAIN_CONFIG.chainId).toBe(42220);
  });

  it("has the correct chain name", () => {
    expect(CELO_CHAIN_CONFIG.name).toBe("Celo");
  });

  it("has CELO as the native currency", () => {
    expect(CELO_CHAIN_CONFIG.nativeCurrency.symbol).toBe("CELO");
    expect(CELO_CHAIN_CONFIG.nativeCurrency.decimals).toBe(18);
  });

  it("includes cUSD and cEUR stablecoins", () => {
    expect(CELO_CHAIN_CONFIG.stablecoins.cUSD.symbol).toBe("cUSD");
    expect(CELO_CHAIN_CONFIG.stablecoins.cUSD.address).toBe(CUSD_TOKEN_ADDRESS);
    expect(CELO_CHAIN_CONFIG.stablecoins.cEUR.symbol).toBe("cEUR");
    expect(CELO_CHAIN_CONFIG.stablecoins.cEUR.address).toBe(CEUR_TOKEN_ADDRESS);
  });
});

/* ---------- utility functions ---------- */

describe("cUSD conversion utilities", () => {
  it("converts 1 cUSD to 1e18 smallest unit", () => {
    expect(cusdToSmallestUnit(1)).toBe("1000000000000000000");
  });

  it("converts 0.5 cUSD correctly", () => {
    expect(cusdToSmallestUnit(0.5)).toBe("500000000000000000");
  });

  it("converts 0 cUSD to 0", () => {
    expect(cusdToSmallestUnit(0)).toBe("0");
  });

  it("converts smallest unit back to cUSD", () => {
    expect(smallestUnitToCusd("1000000000000000000")).toBe(1);
  });

  it("converts 500000000000000000 back to 0.5 cUSD", () => {
    expect(smallestUnitToCusd("500000000000000000")).toBe(0.5);
  });

  it("round-trips correctly", () => {
    const amount = 1.5;
    const smallest = cusdToSmallestUnit(amount);
    const back = smallestUnitToCusd(smallest);
    expect(back).toBeCloseTo(amount, 6);
  });
});

/* ---------- thirdweb provider Celo support ---------- */

describe("ThirdwebProvider Celo support", () => {
  it("exports supportedChains containing both Arbitrum and Celo", async () => {
    const mod = await import("@/providers/ThirdwebProvider");
    expect(mod.supportedChains).toBeDefined();

    const chainIds = mod.supportedChains.map(
      (c: { id: number }) => c.id,
    );
    expect(chainIds).toContain(42161); // Arbitrum
    expect(chainIds).toContain(42220); // Celo
  });

  it("exports thirdwebClient", async () => {
    const mod = await import("@/providers/ThirdwebProvider");
    expect(mod.thirdwebClient).toBeDefined();
  });
});
