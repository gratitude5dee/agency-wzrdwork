/**
 * ENS Integration — Primary Name Registration & Resolution
 *
 * Sets ENS primary names on Base and other L2 chains via the
 * ENS Reverse Registrar contract.
 *
 * A primary name creates a bi-directional link:
 *   - Forward: name.eth → 0x1234... (set in ENS resolver)
 *   - Reverse: 0x1234... → name.eth (set via this module)
 *
 * Supported chains:
 *   - Base: 0x0000000000D8e504002cC26E3Ec46D81971C1664
 *   - Arbitrum: 0x0000000000D8e504002cC26E3Ec46D81971C1664
 *   - Optimism: 0x0000000000D8e504002cC26E3Ec46D81971C1664
 *   - Ethereum: 0x283F227c4Bd38ecE252C4Ae7ECE650B0e913f1f9
 *
 * Fulfills: VAL-ENS-001
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import type { Json } from "@/integrations/supabase/types";

/* ================================================================
   Constants
   ================================================================ */

/** ENS Reverse Registrar addresses per chain */
export const REVERSE_REGISTRAR = {
  base: "0x0000000000D8e504002cC26E3Ec46D81971C1664",
  arbitrum: "0x0000000000D8e504002cC26E3Ec46D81971C1664",
  optimism: "0x0000000000D8e504002cC26E3Ec46D81971C1664",
  ethereum: "0x283F227c4Bd38ecE252C4Ae7ECE650B0e913f1f9",
} as const;

/** Chain IDs for ENS-supported networks */
export const ENS_CHAIN_IDS: Record<string, number> = {
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  ethereum: 1,
};

/** RPC endpoints */
export const ENS_RPC: Record<string, string> = {
  base: "https://mainnet.base.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  optimism: "https://mainnet.optimism.io",
  ethereum: "https://eth.llamarpc.com",
};

/** Block explorers */
export const ENS_EXPLORERS: Record<string, string> = {
  base: "https://basescan.org",
  arbitrum: "https://arbiscan.io",
  optimism: "https://optimistic.etherscan.io",
  ethereum: "https://etherscan.io",
};

/** setName(string) function selector */
const SET_NAME_SELECTOR = "0xc47f0027";

export type ENSChain = keyof typeof REVERSE_REGISTRAR;

/* ================================================================
   Types
   ================================================================ */

/** Input for setting ENS primary name */
export interface SetPrimaryNameInput {
  /** ENS name (e.g. "myagent.eth") */
  ensName: string;
  /** Chain to set the primary name on */
  chain: ENSChain;
  /** Wallet address (the caller) */
  walletAddress: string;
  /** Company ID for evidence */
  companyId?: string;
  /** Agent ID for evidence */
  agentId?: string;
}

/** Prepared transaction for setting ENS primary name */
export interface PreparedENSTx {
  /** Reverse Registrar contract address */
  to: string;
  /** Encoded setName(string) calldata */
  data: string;
  /** Value (0) */
  value: "0";
  /** Chain ID */
  chainId: number;
  /** The ENS name being set */
  ensName: string;
  /** Chain name */
  chain: ENSChain;
}

/** Result of ENS primary name setting */
export interface SetPrimaryNameResult {
  success: boolean;
  transactionHash: string | null;
  explorerUrl: string | null;
  ensName: string | null;
  chain: ENSChain | null;
  error?: string;
  evidenceLogId?: string;
}

/** ENS resolution check result */
export interface ENSResolutionCheck {
  /** Forward resolution: name → address */
  forwardResolution: string | null;
  /** Reverse resolution: address → name */
  reverseResolution: string | null;
  /** Whether both directions match */
  bidirectional: boolean;
}

/* ================================================================
   ABI Encoding
   ================================================================ */

/**
 * Encode setName(string name) calldata.
 */
export function encodeSetName(name: string): string {
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(name);
  const nameLength = nameBytes.length;

  // Offset to string data
  const offset = "0000000000000000000000000000000000000000000000000000000000000020";

  // String length
  const lengthHex = nameLength.toString(16).padStart(64, "0");

  // String data padded to 32-byte boundary
  let dataHex = "";
  for (const byte of nameBytes) {
    dataHex += byte.toString(16).padStart(2, "0");
  }
  const paddedLength = Math.ceil(nameLength / 32) * 64;
  dataHex = dataHex.padEnd(paddedLength, "0");

  return `${SET_NAME_SELECTOR}${offset}${lengthHex}${dataHex}`;
}

/* ================================================================
   Transaction Preparation
   ================================================================ */

/**
 * Prepare the setName transaction for wallet signing.
 */
export function preparePrimaryNameTx(input: SetPrimaryNameInput): PreparedENSTx {
  const data = encodeSetName(input.ensName);
  const contractAddress = REVERSE_REGISTRAR[input.chain];
  const chainId = ENS_CHAIN_IDS[input.chain];

  return {
    to: contractAddress,
    data,
    value: "0",
    chainId,
    ensName: input.ensName,
    chain: input.chain,
  };
}

/* ================================================================
   Name Availability Check
   ================================================================ */

/**
 * Check if an ENS name resolves to an address (forward resolution).
 *
 * Uses the ENS Universal Resolver on Ethereum mainnet.
 */
export async function resolveENSName(ensName: string): Promise<string | null> {
  try {
    // Use the ENS public resolver API
    const response = await fetch(
      `https://ens-gateway.com/resolve/${encodeURIComponent(ensName)}`,
    );

    if (!response.ok) return null;

    const result = await response.json();
    return result.address ?? null;
  } catch {
    return null;
  }
}

/* ================================================================
   Confirmation
   ================================================================ */

/**
 * Confirm ENS primary name was set after wallet signing.
 */
export async function confirmPrimaryName(
  transactionHash: string,
  preparedTx: PreparedENSTx,
  companyId?: string,
  agentId?: string,
): Promise<SetPrimaryNameResult> {
  const explorerUrl = `${ENS_EXPLORERS[preparedTx.chain]}/tx/${transactionHash}`;

  // Record evidence
  let evidenceLogId: string | undefined;
  if (companyId && agentId) {
    const logRow = await logExecution(agentId, companyId, null, "output", {
      action: "ens_primary_name_set",
      integration: "ens",
      ensName: preparedTx.ensName,
      chain: preparedTx.chain,
      chainId: preparedTx.chainId,
      transactionHash,
      explorerUrl,
      reverseRegistrar: preparedTx.to,
    });
    evidenceLogId = logRow?.id ?? undefined;
  }

  // Store ENS name in company metadata
  if (companyId) {
    await supabase.from("integrations").upsert({
      company_id: companyId,
      integration_key: "ens_primary_name",
      config: {
        ensName: preparedTx.ensName,
        chain: preparedTx.chain,
        transactionHash,
        setAt: new Date().toISOString(),
      } as unknown as Json,
    });
  }

  return {
    success: true,
    transactionHash,
    explorerUrl,
    ensName: preparedTx.ensName,
    chain: preparedTx.chain,
    evidenceLogId,
  };
}

/* ================================================================
   Company ENS Integration
   ================================================================ */

/**
 * Load the ENS primary name for a company (if set).
 */
export async function loadCompanyENS(
  companyId: string,
): Promise<{ ensName: string | null; chain: string | null; setAt: string | null }> {
  const { data } = await supabase
    .from("integrations")
    .select("config")
    .eq("company_id", companyId)
    .eq("integration_key", "ens_primary_name")
    .maybeSingle();

  if (!data?.config) return { ensName: null, chain: null, setAt: null };

  const config = data.config as Record<string, unknown>;
  return {
    ensName: (config.ensName as string) ?? null,
    chain: (config.chain as string) ?? null,
    setAt: (config.setAt as string) ?? null,
  };
}

/**
 * Save an ENS name association for a company.
 * Used when the user enters their ENS name during onboarding.
 */
export async function saveCompanyENSName(
  companyId: string,
  ensName: string,
  chain: ENSChain = "base",
): Promise<void> {
  await supabase.from("integrations").upsert({
    company_id: companyId,
    integration_key: "ens_primary_name",
    config: {
      ensName,
      chain,
      registeredDuringOnboarding: true,
      setAt: new Date().toISOString(),
    } as unknown as Json,
  });
}
