/**
 * Celo Live Stablecoin Payment — On-Chain Execution
 *
 * Extends the existing Celo payment flow with actual wallet signing
 * and transaction submission for live cUSD/cEUR transfers.
 *
 * Supports two execution paths:
 *   1. Client-side via thirdweb wallet (browser)
 *   2. Server-side via Bankr wallet API (agent autonomous)
 *
 * The ERC-20 transfer is built as raw calldata (transfer(address,uint256))
 * and submitted through the appropriate signing path.
 *
 * Fulfills: VAL-CELO-001 (live stablecoin payments)
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import {
  CELO_CHAIN_CONFIG,
  CUSD_TOKEN_ADDRESS,
  CEUR_TOKEN_ADDRESS,
  cusdToSmallestUnit,
} from "./config";
import { loadCeloConfig } from "./integration-config";
import type { CeloStablecoin } from "./integration-config";

/* ================================================================
   Constants
   ================================================================ */

/** ERC-20 transfer function selector: transfer(address,uint256) */
const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";

/** Celo chain IDs */
export const CELO_CHAINS = {
  mainnet: 42220,
  alfajores: 44787, // Testnet
} as const;

/** Celo RPC endpoints */
export const CELO_RPC = {
  mainnet: "https://forno.celo.org",
  alfajores: "https://alfajores-forno.celo-testnet.org",
} as const;

/** Celo block explorers */
export const CELO_EXPLORERS = {
  mainnet: "https://celoscan.io",
  alfajores: "https://alfajores.celoscan.io",
} as const;

/* ================================================================
   Types
   ================================================================ */

/** Input for executing a live Celo payment */
export interface ExecuteCeloPaymentInput {
  /** Company ID */
  companyId: string;
  /** Agent ID (optional) */
  agentId?: string;
  /** Run ID (optional) */
  runId?: string;
  /** Recipient wallet address */
  recipientAddress: string;
  /** Amount in human-readable units (e.g. 1.5 for 1.5 cUSD) */
  amount: number;
  /** Stablecoin to use */
  stablecoin?: CeloStablecoin;
  /** Sender wallet address */
  senderAddress: string;
  /** Network (mainnet or alfajores) */
  network?: "mainnet" | "alfajores";
  /** Optional memo */
  memo?: string;
}

/** Prepared Celo transaction for wallet signing */
export interface PreparedCeloTx {
  /** Token contract address */
  to: string;
  /** Encoded transfer calldata */
  data: string;
  /** Value (0 for ERC-20 transfers) */
  value: "0";
  /** Chain ID */
  chainId: number;
  /** Human-readable amount */
  amountHuman: number;
  /** Amount in smallest units */
  amountSmallestUnit: string;
  /** Stablecoin used */
  stablecoin: CeloStablecoin;
  /** Recipient address */
  recipientAddress: string;
  /** Sender address */
  senderAddress: string;
  /** Network */
  network: "mainnet" | "alfajores";
}

/** Result of a live Celo payment */
export interface CeloPaymentExecutionResult {
  success: boolean;
  /** Transaction hash */
  transactionHash: string | null;
  /** Block explorer URL */
  explorerUrl: string | null;
  /** Amount transferred */
  amountHuman: number | null;
  /** Stablecoin used */
  stablecoin: CeloStablecoin | null;
  /** Recipient */
  recipientAddress: string | null;
  /** Error */
  error?: string;
  /** Evidence log ID */
  evidenceLogId?: string;
}

/* ================================================================
   ABI Encoding
   ================================================================ */

/**
 * Encode an ERC-20 transfer(address,uint256) call.
 *
 * @param recipient - Recipient address (0x-prefixed)
 * @param amountSmallestUnit - Amount in smallest units (18 decimals for cUSD/cEUR)
 * @returns Encoded calldata
 */
export function encodeERC20Transfer(
  recipient: string,
  amountSmallestUnit: string,
): string {
  // Remove 0x prefix from address and pad to 32 bytes
  const addressHex = recipient.replace("0x", "").toLowerCase().padStart(64, "0");

  // Convert amount to hex and pad to 32 bytes
  const amountBigInt = BigInt(amountSmallestUnit);
  const amountHex = amountBigInt.toString(16).padStart(64, "0");

  return `${ERC20_TRANSFER_SELECTOR}${addressHex}${amountHex}`;
}

/* ================================================================
   Transaction Preparation
   ================================================================ */

/**
 * Prepare a Celo stablecoin payment transaction.
 *
 * Returns all the data needed for wallet signing.
 */
export async function prepareCeloPayment(
  input: ExecuteCeloPaymentInput,
): Promise<PreparedCeloTx> {
  // Load config if network not specified
  let network = input.network;
  let stablecoin = input.stablecoin;

  if (!network || !stablecoin) {
    const config = await loadCeloConfig(input.companyId);
    network = network ?? (config.network as "mainnet" | "alfajores") ?? "mainnet";
    stablecoin = stablecoin ?? config.preferredStablecoin ?? "cUSD";
  }

  // Resolve token address
  const tokenAddress = stablecoin === "cUSD" ? CUSD_TOKEN_ADDRESS : CEUR_TOKEN_ADDRESS;

  // Convert amount to smallest units (18 decimals)
  const amountSmallestUnit = cusdToSmallestUnit(input.amount);

  // Encode calldata
  const data = encodeERC20Transfer(input.recipientAddress, amountSmallestUnit);

  return {
    to: tokenAddress,
    data,
    value: "0",
    chainId: CELO_CHAINS[network],
    amountHuman: input.amount,
    amountSmallestUnit,
    stablecoin,
    recipientAddress: input.recipientAddress,
    senderAddress: input.senderAddress,
    network,
  };
}

/* ================================================================
   Payment Confirmation
   ================================================================ */

/**
 * Confirm a successful Celo payment after wallet signing.
 */
export async function confirmCeloPayment(
  transactionHash: string,
  preparedTx: PreparedCeloTx,
  companyId: string,
  agentId?: string,
  runId?: string,
): Promise<CeloPaymentExecutionResult> {
  const explorerUrl = `${CELO_EXPLORERS[preparedTx.network]}/tx/${transactionHash}`;

  // Record evidence
  let evidenceLogId: string | undefined;
  if (agentId) {
    const logRow = await logExecution(agentId, companyId, runId ?? null, "output", {
      action: "celo_payment_executed",
      integration: "celo",
      network: preparedTx.network,
      chainId: preparedTx.chainId,
      stablecoin: preparedTx.stablecoin,
      tokenAddress: preparedTx.to,
      amountHuman: preparedTx.amountHuman,
      amountSmallestUnit: preparedTx.amountSmallestUnit,
      senderAddress: preparedTx.senderAddress,
      recipientAddress: preparedTx.recipientAddress,
      transactionHash,
      explorerUrl,
      status: "confirmed",
    });
    evidenceLogId = logRow?.id ?? undefined;
  }

  // Record activity event
  await supabase.from("activity_events").insert({
    company_id: companyId,
    agent_id: agentId ?? null,
    action: "celo_payment_confirmed",
    details: `Celo payment confirmed: ${preparedTx.amountHuman} ${preparedTx.stablecoin} to ${preparedTx.recipientAddress.slice(0, 8)}... TX: ${transactionHash}`,
  });

  // Update the original payment evidence log if it exists
  // (from the preparatory executeCeloPayment flow)
  if (agentId) {
    const { data: existingLogs } = await supabase
      .from("agent_execution_logs")
      .select("id, content")
      .eq("agent_id", agentId)
      .eq("company_id", companyId)
      .eq("log_type", "output")
      .order("created_at", { ascending: false })
      .limit(5);

    // Find the "prepared" log and update it
    const preparedLog = existingLogs?.find((log) => {
      const content = log.content as Record<string, unknown> | null;
      return (
        content?.action === "celo_payment" &&
        content?.status === "prepared" &&
        content?.recipientAddress === preparedTx.recipientAddress
      );
    });

    if (preparedLog) {
      const updatedContent = {
        ...(preparedLog.content as Record<string, unknown>),
        status: "confirmed",
        transactionHash,
        explorerUrl,
        confirmedAt: new Date().toISOString(),
      };

      await supabase
        .from("agent_execution_logs")
        .update({ content: updatedContent as unknown as import("@/integrations/supabase/types").Json })
        .eq("id", preparedLog.id);
    }
  }

  return {
    success: true,
    transactionHash,
    explorerUrl,
    amountHuman: preparedTx.amountHuman,
    stablecoin: preparedTx.stablecoin,
    recipientAddress: preparedTx.recipientAddress,
    evidenceLogId,
  };
}

/* ================================================================
   Server-Side Payment (via Bankr)
   ================================================================ */

/**
 * Execute a Celo payment autonomously via Bankr wallet.
 *
 * For agents that need to make payments without browser wallet interaction.
 */
export async function executeCeloPaymentViaBankr(
  input: ExecuteCeloPaymentInput & { bankrApiKey: string },
): Promise<CeloPaymentExecutionResult> {
  try {
    // 1. Prepare the transaction
    const prepared = await prepareCeloPayment(input);

    // 2. Submit via Bankr
    const response = await fetch("https://api.bankr.bot/agent/prompt", {
      method: "POST",
      headers: {
        "X-API-Key": input.bankrApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: `Submit this transaction on Celo: ${JSON.stringify({
          to: prepared.to,
          data: prepared.data,
          value: prepared.value,
          chainId: prepared.chainId,
        })}`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Bankr tx submission failed (${response.status})`);
    }

    const result = await response.json();
    const txHash = result.txHash ?? result.jobId ?? null;

    if (!txHash) {
      throw new Error("Bankr did not return a transaction hash");
    }

    // 3. Confirm the payment
    return confirmCeloPayment(
      txHash,
      prepared,
      input.companyId,
      input.agentId,
      input.runId,
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    if (input.agentId) {
      await logExecution(
        input.agentId,
        input.companyId,
        input.runId ?? null,
        "failure",
        {
          action: "celo_payment_failed",
          integration: "celo",
          error,
          recipientAddress: input.recipientAddress,
          amount: input.amount,
        },
      );
    }

    return {
      success: false,
      transactionHash: null,
      explorerUrl: null,
      amountHuman: input.amount,
      stablecoin: input.stablecoin ?? "cUSD",
      recipientAddress: input.recipientAddress,
      error,
    };
  }
}

/* ================================================================
   Balance Check
   ================================================================ */

/**
 * Check the cUSD balance of a wallet on Celo.
 *
 * Uses the ERC-20 balanceOf(address) call via RPC.
 */
export async function checkCeloBalance(
  walletAddress: string,
  stablecoin: CeloStablecoin = "cUSD",
  network: "mainnet" | "alfajores" = "mainnet",
): Promise<{ balance: string; balanceHuman: number }> {
  const tokenAddress = stablecoin === "cUSD" ? CUSD_TOKEN_ADDRESS : CEUR_TOKEN_ADDRESS;
  const rpcUrl = CELO_RPC[network];

  // balanceOf(address) selector: 0x70a08231
  const addressHex = walletAddress.replace("0x", "").toLowerCase().padStart(64, "0");
  const data = `0x70a08231${addressHex}`;

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: tokenAddress, data }, "latest"],
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Celo RPC call failed (${response.status})`);
  }

  const result = await response.json();
  const balanceHex = result.result ?? "0x0";
  const balanceBigInt = BigInt(balanceHex);
  const balanceHuman = Number(balanceBigInt) / 1e18;

  return {
    balance: balanceBigInt.toString(),
    balanceHuman,
  };
}
