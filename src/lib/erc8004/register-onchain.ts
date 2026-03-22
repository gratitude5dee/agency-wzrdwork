/**
 * ERC-8004 On-Chain Registration
 *
 * Registers an agent identity on Ethereum mainnet (or Sepolia testnet)
 * via the ERC-8004 Identity Registry contract.
 *
 * Supports multiple registration strategies:
 *   1. Data URI (fully on-chain, no external hosting)
 *   2. IPFS via Pinata (decentralized, persistent)
 *   3. HTTP URL (simple, centralized)
 *
 * Uses thirdweb SDK for wallet signing and transaction submission.
 *
 * Contract: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 (mainnet)
 * Contract: 0x8004A818BFB912233c491871b3d84c89A494BD9e (sepolia)
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "./execution-log";
import { buildManifest } from "./manifest";
import type { AgentManifest } from "./types";
import type { Json } from "@/integrations/supabase/types";
import type { ExecutionLogType } from "./types";

/* ================================================================
   Constants
   ================================================================ */

/** ERC-8004 Identity Registry addresses */
export const ERC8004_REGISTRY = {
  mainnet: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const,
  sepolia: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const,
} as const;

/** ERC-8004 Reputation Registry addresses */
export const ERC8004_REPUTATION = {
  mainnet: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const,
  sepolia: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const,
} as const;

/** ERC-8004 Identity Registry ABI (minimal — register + tokenURI) */
export const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "Transfer",
    type: "event",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

/** Chain IDs */
export const CHAIN_IDS = {
  mainnet: 1,
  sepolia: 11155111,
} as const;

/* ================================================================
   Types
   ================================================================ */

/** Registration strategy */
export type RegistrationStrategy = "data-uri" | "ipfs" | "http";

/** Network target */
export type RegistrationNetwork = "mainnet" | "sepolia";

/** ERC-8004 registration file format */
export interface ERC8004RegistrationFile {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
  name: string;
  description: string;
  image?: string;
  services?: Array<{
    name: string;
    endpoint: string;
    version?: string;
  }>;
  x402Support: boolean;
  active: boolean;
  registrations?: Array<{
    agentId: number;
    agentRegistry: string;
  }>;
  supportedTrust?: string[];
}

/** Input for on-chain registration */
export interface RegisterOnChainInput {
  /** Agent UUID in Supabase */
  agentId: string;
  /** Company UUID */
  companyId: string;
  /** Operator wallet address (the signer) */
  operatorWallet: string;
  /** Agent name */
  agentName: string;
  /** Agent description */
  agentDescription: string;
  /** Optional avatar URL */
  agentImage?: string;
  /** Network to register on */
  network: RegistrationNetwork;
  /** Registration strategy */
  strategy: RegistrationStrategy;
  /** IPFS options (when strategy = "ipfs") */
  ipfs?: {
    pinataJwt: string;
  };
  /** HTTP URL (when strategy = "http") */
  httpUrl?: string;
  /** Service endpoints to include */
  services?: Array<{
    name: string;
    endpoint: string;
    version?: string;
  }>;
  /** Whether agent supports x402 payments */
  x402Support?: boolean;
}

/** Result of on-chain registration */
export interface RegisterOnChainResult {
  success: boolean;
  /** On-chain agent ID (token ID) */
  agentTokenId: number | null;
  /** Transaction hash */
  transactionHash: string | null;
  /** Block explorer URL */
  explorerUrl: string | null;
  /** The agent URI used for registration */
  agentUri: string | null;
  /** Registration file content */
  registrationFile: ERC8004RegistrationFile | null;
  /** Error message if failed */
  error?: string;
  /** Evidence log ID */
  evidenceLogId?: string;
}

/** Prepared transaction for client-side signing */
export interface PreparedRegistrationTx {
  /** Contract address (Identity Registry) */
  to: string;
  /** Encoded calldata for register(agentURI) */
  data: string;
  /** Chain ID */
  chainId: number;
  /** Value (0 for registration) */
  value: "0";
  /** The agentURI being registered */
  agentUri: string;
  /** The registration file for reference */
  registrationFile: ERC8004RegistrationFile;
  /** Network name */
  network: RegistrationNetwork;
}

/* ================================================================
   Registration File Builder
   ================================================================ */

/**
 * Build an ERC-8004 registration file from agent data.
 */
export function buildRegistrationFile(
  input: Pick<
    RegisterOnChainInput,
    "agentName" | "agentDescription" | "agentImage" | "services" | "x402Support"
  >,
): ERC8004RegistrationFile {
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: input.agentName,
    description: input.agentDescription,
    image: input.agentImage,
    services: input.services ?? [],
    x402Support: input.x402Support ?? false,
    active: true,
    registrations: [], // Populated after on-chain registration
    supportedTrust: ["reputation"],
  };
}

/* ================================================================
   URI Builders
   ================================================================ */

/**
 * Encode a registration file as a base64 data URI.
 * This is fully on-chain — no external hosting needed.
 */
export function buildDataUri(registrationFile: ERC8004RegistrationFile): string {
  const json = JSON.stringify(registrationFile);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return `data:application/json;base64,${base64}`;
}

/**
 * Upload a registration file to IPFS via Pinata.
 */
export async function uploadToIpfs(
  registrationFile: ERC8004RegistrationFile,
  pinataJwt: string,
): Promise<string> {
  const blob = new Blob([JSON.stringify(registrationFile, null, 2)], {
    type: "application/json",
  });

  const formData = new FormData();
  formData.append("file", blob, "agent.json");
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: `erc8004-${registrationFile.name}`,
    }),
  );

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Pinata upload failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return `ipfs://${result.IpfsHash}`;
}

/* ================================================================
   ABI Encoding
   ================================================================ */

/**
 * Encode the register(string agentURI) calldata.
 *
 * ABI encoding for a single string parameter:
 *   - 4 bytes: function selector (keccak256("register(string)")[:4])
 *   - 32 bytes: offset to string data (0x20)
 *   - 32 bytes: string length
 *   - N*32 bytes: string data (padded to 32-byte boundary)
 */
export function encodeRegisterCalldata(agentUri: string): string {
  // Function selector: keccak256("register(string)") first 4 bytes
  // Pre-computed: 0xf2c298be
  const selector = "0xf2c298be";

  // Encode the string parameter
  const encoder = new TextEncoder();
  const uriBytes = encoder.encode(agentUri);
  const uriLength = uriBytes.length;

  // Offset to string data (always 0x20 = 32 for single param)
  const offset = "0000000000000000000000000000000000000000000000000000000000000020";

  // String length
  const lengthHex = uriLength.toString(16).padStart(64, "0");

  // String data padded to 32-byte boundary
  let dataHex = "";
  for (const byte of uriBytes) {
    dataHex += byte.toString(16).padStart(2, "0");
  }
  // Pad to next 32-byte boundary
  const paddedLength = Math.ceil(uriLength / 32) * 64;
  dataHex = dataHex.padEnd(paddedLength, "0");

  return `${selector}${offset}${lengthHex}${dataHex}`;
}

/* ================================================================
   Transaction Preparation
   ================================================================ */

/**
 * Prepare the registration transaction without signing.
 *
 * Returns all the data needed for the wallet to sign and submit.
 * This can be used with thirdweb's `sendTransaction` or any
 * wallet signing flow.
 */
export async function prepareRegistrationTx(
  input: RegisterOnChainInput,
): Promise<PreparedRegistrationTx> {
  // 1. Build the registration file
  const registrationFile = buildRegistrationFile(input);

  // 2. Build the agent URI based on strategy
  let agentUri: string;
  switch (input.strategy) {
    case "data-uri":
      agentUri = buildDataUri(registrationFile);
      break;
    case "ipfs":
      if (!input.ipfs?.pinataJwt) {
        throw new Error("IPFS strategy requires pinataJwt");
      }
      agentUri = await uploadToIpfs(registrationFile, input.ipfs.pinataJwt);
      break;
    case "http":
      if (!input.httpUrl) {
        throw new Error("HTTP strategy requires httpUrl");
      }
      agentUri = input.httpUrl;
      break;
    default:
      throw new Error(`Unknown registration strategy: ${input.strategy}`);
  }

  // 3. Encode calldata
  const data = encodeRegisterCalldata(agentUri);

  // 4. Get contract address
  const contractAddress = ERC8004_REGISTRY[input.network];
  const chainId = CHAIN_IDS[input.network];

  return {
    to: contractAddress,
    data,
    chainId,
    value: "0",
    agentUri,
    registrationFile,
    network: input.network,
  };
}

/* ================================================================
   Evidence Recording
   ================================================================ */

/**
 * Record an ERC-8004 registration event in execution logs.
 */
async function recordRegistrationEvidence(
  companyId: string,
  agentId: string,
  logType: ExecutionLogType,
  content: Record<string, unknown>,
): Promise<string | null> {
  try {
    const logRow = await logExecution(agentId, companyId, null, logType, content);
    return logRow?.id ?? null;
  } catch {
    return null;
  }
}

/* ================================================================
   Full Registration Flow
   ================================================================ */

/**
 * Execute the full ERC-8004 on-chain registration flow.
 *
 * This function:
 *   1. Builds the registration file
 *   2. Uploads to IPFS / builds data URI / uses HTTP URL
 *   3. Prepares the transaction
 *   4. Records evidence in execution logs
 *   5. Returns the prepared tx for wallet signing
 *
 * The actual transaction signing and submission happens on the client
 * side via thirdweb's wallet. After the tx is confirmed, call
 * `confirmRegistration()` to update the database.
 */
export async function initiateRegistration(
  input: RegisterOnChainInput,
): Promise<{
  preparedTx: PreparedRegistrationTx;
  evidenceLogId: string | null;
}> {
  // 1. Prepare the transaction
  const preparedTx = await prepareRegistrationTx(input);

  // 2. Record evidence
  const evidenceLogId = await recordRegistrationEvidence(
    input.companyId,
    input.agentId,
    "output",
    {
      action: "erc8004_registration_initiated",
      integration: "erc8004",
      network: input.network,
      strategy: input.strategy,
      contractAddress: preparedTx.to,
      chainId: preparedTx.chainId,
      agentUri: preparedTx.agentUri,
      registrationFile: preparedTx.registrationFile,
      operatorWallet: input.operatorWallet,
      status: "pending_signature",
    },
  );

  return { preparedTx, evidenceLogId };
}

/**
 * Confirm a successful on-chain registration.
 *
 * Called after the wallet successfully signs and submits the transaction.
 * Updates the agent_identities row with on-chain data.
 */
export async function confirmRegistration(
  agentId: string,
  companyId: string,
  transactionHash: string,
  agentTokenId: number,
  network: RegistrationNetwork,
  agentUri: string,
): Promise<RegisterOnChainResult> {
  const explorerBase =
    network === "mainnet"
      ? "https://etherscan.io/tx"
      : "https://sepolia.etherscan.io/tx";
  const explorerUrl = `${explorerBase}/${transactionHash}`;

  // 1. Update agent_identities
  const { error: updateError } = await supabase
    .from("agent_identities")
    .update({
      registered_on_chain: true,
      manifest: {
        // Spread existing manifest + add on-chain fields
        onchain_agent_id: agentTokenId,
        registration_tx: transactionHash,
        registration_network: network,
        agent_uri: agentUri,
        registry_address: ERC8004_REGISTRY[network],
        registered_at: new Date().toISOString(),
      } as unknown as Json,
    })
    .eq("agent_id", agentId)
    .eq("company_id", companyId);

  if (updateError) {
    return {
      success: false,
      agentTokenId,
      transactionHash,
      explorerUrl,
      agentUri,
      registrationFile: null,
      error: `Failed to update identity: ${updateError.message}`,
    };
  }

  // 2. Record confirmation evidence
  await recordRegistrationEvidence(companyId, agentId, "output", {
    action: "erc8004_registration_confirmed",
    integration: "erc8004",
    network,
    transactionHash,
    explorerUrl,
    agentTokenId,
    agentUri,
    registryAddress: ERC8004_REGISTRY[network],
    status: "confirmed",
  });

  // 3. Record activity event
  await supabase.from("activity_events").insert({
    company_id: companyId,
    agent_id: agentId,
    action: "erc8004_registered",
    details: `Agent registered on-chain (ERC-8004) on ${network}. Token ID: ${agentTokenId}. TX: ${transactionHash}`,
  });

  return {
    success: true,
    agentTokenId,
    transactionHash,
    explorerUrl,
    agentUri,
    registrationFile: null,
  };
}

/* ================================================================
   Lookup Helpers
   ================================================================ */

/**
 * Check if an agent is already registered on-chain.
 */
export async function isRegisteredOnChain(
  agentId: string,
  companyId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("agent_identities")
    .select("registered_on_chain")
    .eq("agent_id", agentId)
    .eq("company_id", companyId)
    .single();

  return data?.registered_on_chain === true;
}

/**
 * Get the on-chain registration details for an agent.
 */
export async function getOnChainRegistration(
  agentId: string,
  companyId: string,
): Promise<{
  registered: boolean;
  agentTokenId?: number;
  transactionHash?: string;
  network?: string;
  explorerUrl?: string;
} | null> {
  const { data } = await supabase
    .from("agent_identities")
    .select("registered_on_chain, manifest")
    .eq("agent_id", agentId)
    .eq("company_id", companyId)
    .single();

  if (!data) return null;

  const manifest = data.manifest as Record<string, unknown> | null;
  if (!data.registered_on_chain || !manifest) {
    return { registered: false };
  }

  const network = (manifest.registration_network as string) ?? "mainnet";
  const txHash = manifest.registration_tx as string | undefined;
  const explorerBase =
    network === "mainnet"
      ? "https://etherscan.io/tx"
      : "https://sepolia.etherscan.io/tx";

  return {
    registered: true,
    agentTokenId: manifest.onchain_agent_id as number | undefined,
    transactionHash: txHash,
    network,
    explorerUrl: txHash ? `${explorerBase}/${txHash}` : undefined,
  };
}
