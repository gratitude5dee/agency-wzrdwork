/**
 * Bankr Signals — Provider Registration & Signal Publishing
 *
 * Integrates with the Bankr Signals API for transaction-verified
 * trading signals on Base blockchain.
 *
 * Agents can:
 *   1. Register as signal providers (EIP-191 signature required)
 *   2. Publish trading signals with TX hash proof
 *   3. Close positions with exit data and PnL
 *   4. Read the signal feed and leaderboard
 *
 * API Base: https://bankrsignals.com/api
 * Dashboard: https://bankrsignals.com
 *
 * Fulfills: VAL-BANKR-SIGNALS-001
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import type { ExecutionLogType } from "@/lib/erc8004/types";

/* ================================================================
   Constants
   ================================================================ */

const BANKR_SIGNALS_API = "https://bankrsignals.com/api";
const BANKR_SIGN_API = "https://api.bankr.bot/agent/sign";

/* ================================================================
   Types
   ================================================================ */

export type SignalAction = "BUY" | "SELL" | "LONG" | "SHORT";
export type SignalStatus = "open" | "closed";
export type RiskLevel = "low" | "medium" | "high" | "extreme";
export type TimeFrame = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w";
export type SignalCategory = "spot" | "leverage" | "swing" | "scalp";

/** Input for registering as a signal provider */
export interface RegisterProviderInput {
  /** Bankr API key (bk_...) */
  bankrApiKey: string;
  /** Wallet address (or null to auto-detect from Bankr) */
  walletAddress?: string;
  /** Display name for the provider */
  name: string;
  /** Short bio (max 280 chars) */
  bio?: string;
  /** Avatar URL */
  avatar?: string;
  /** Chain to register on */
  chain?: string;
  /** Agent harness identifier */
  agent?: string;
  /** Social handles */
  twitter?: string;
  farcaster?: string;
  github?: string;
  website?: string;
  /** Company/agent context for evidence */
  companyId?: string;
  agentId?: string;
}

/** Result of provider registration */
export interface RegisterProviderResult {
  success: boolean;
  walletAddress: string | null;
  providerName: string | null;
  error?: string;
}

/** Input for publishing a trading signal */
export interface PublishSignalInput {
  /** Bankr API key */
  bankrApiKey: string;
  /** Provider wallet address */
  providerAddress: string;
  /** Trade action */
  action: SignalAction;
  /** Token symbol (e.g. "ETH", "BTC") */
  token: string;
  /** Entry price */
  entryPrice: number;
  /** Base transaction hash proving the trade */
  txHash: string;
  /** Position size in USD (required) */
  collateralUsd: number;
  /** Leverage multiplier */
  leverage?: number;
  /** Confidence level 0-1 */
  confidence?: number;
  /** Trading reasoning/thesis */
  reasoning?: string;
  /** Stop loss percentage */
  stopLossPct?: number;
  /** Take profit percentage */
  takeProfitPct?: number;
  /** Signal category */
  category?: SignalCategory;
  /** Risk level */
  riskLevel?: RiskLevel;
  /** Time frame */
  timeFrame?: TimeFrame;
  /** Tags */
  tags?: string[];
  /** Chain (default: "base") */
  chain?: string;
  /** Company/agent context for evidence */
  companyId?: string;
  agentId?: string;
  runId?: string;
}

/** Result of publishing a signal */
export interface PublishSignalResult {
  success: boolean;
  signalId: string | null;
  error?: string;
}

/** Input for closing a signal */
export interface CloseSignalInput {
  /** Bankr API key */
  bankrApiKey: string;
  /** Provider wallet address */
  providerAddress: string;
  /** Signal ID to close */
  signalId: string;
  /** Token symbol (for signature message) */
  token: string;
  /** Exit price */
  exitPrice: number;
  /** Exit transaction hash */
  exitTxHash: string;
  /** PnL percentage */
  pnlPct?: number;
  /** PnL in USD */
  pnlUsd?: number;
  /** Company/agent context */
  companyId?: string;
  agentId?: string;
}

/** Result of closing a signal */
export interface CloseSignalResult {
  success: boolean;
  error?: string;
}

/** Signal feed entry */
export interface SignalFeedEntry {
  id: string;
  provider: string;
  providerName: string;
  action: SignalAction;
  token: string;
  entryPrice: number;
  exitPrice?: number;
  leverage?: number;
  confidence?: number;
  reasoning?: string;
  txHash: string;
  collateralUsd: number;
  status: SignalStatus;
  pnlPct?: number;
  pnlUsd?: number;
  createdAt: string;
}

/** Leaderboard entry */
export interface LeaderboardEntry {
  address: string;
  name: string;
  totalPnl: number;
  winRate: number;
  signalCount: number;
  streak: number;
}

/* ================================================================
   Bankr Wallet Signing
   ================================================================ */

/**
 * Sign a message using Bankr's synchronous sign endpoint.
 * Returns the signature and signer address.
 */
async function signWithBankr(
  bankrApiKey: string,
  message: string,
): Promise<{ signature: string; signer: string }> {
  const response = await fetch(BANKR_SIGN_API, {
    method: "POST",
    headers: {
      "X-API-Key": bankrApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      signatureType: "personal_sign",
      message,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Bankr sign failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  if (!result.success || !result.signature || !result.signer) {
    throw new Error(`Bankr sign returned invalid response: ${JSON.stringify(result)}`);
  }

  return { signature: result.signature, signer: result.signer };
}

/**
 * Get the Bankr wallet address for an API key.
 */
export async function getBankrWalletAddress(bankrApiKey: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000);
  const message = `bankr-signals:ping:${timestamp}`;
  const { signer } = await signWithBankr(bankrApiKey, message);
  return signer;
}

/* ================================================================
   Evidence Recording
   ================================================================ */

async function recordSignalEvidence(
  companyId: string | undefined,
  agentId: string | undefined,
  logType: ExecutionLogType,
  content: Record<string, unknown>,
): Promise<string | null> {
  if (!companyId || !agentId) return null;
  try {
    const logRow = await logExecution(agentId, companyId, null, logType, content);
    return logRow?.id ?? null;
  } catch {
    return null;
  }
}

/* ================================================================
   Provider Registration
   ================================================================ */

/**
 * Register as a Bankr Signals provider.
 *
 * Uses Bankr's wallet signing API for EIP-191 signatures.
 */
export async function registerSignalProvider(
  input: RegisterProviderInput,
): Promise<RegisterProviderResult> {
  try {
    // 1. Get wallet address (auto-detect if not provided)
    let walletAddress = input.walletAddress;
    if (!walletAddress) {
      walletAddress = await getBankrWalletAddress(input.bankrApiKey);
    }

    // 2. Sign registration message
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `bankr-signals:register:${walletAddress}:${timestamp}`;
    const { signature } = await signWithBankr(input.bankrApiKey, message);

    // 3. Register with Bankr Signals API
    const response = await fetch(`${BANKR_SIGNALS_API}/providers/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: walletAddress,
        name: input.name,
        bio: input.bio,
        avatar: input.avatar,
        chain: input.chain ?? "base",
        agent: input.agent ?? "agency-wzrdwork",
        twitter: input.twitter,
        farcaster: input.farcaster,
        github: input.github,
        website: input.website,
        message,
        signature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Registration failed (${response.status}): ${errorText}`);
    }

    // 4. Record evidence
    await recordSignalEvidence(input.companyId, input.agentId, "output", {
      action: "bankr_signals_provider_registered",
      integration: "bankr-signals",
      walletAddress,
      providerName: input.name,
      chain: input.chain ?? "base",
    });

    return {
      success: true,
      walletAddress,
      providerName: input.name,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await recordSignalEvidence(input.companyId, input.agentId, "failure", {
      action: "bankr_signals_registration_failed",
      integration: "bankr-signals",
      error,
    });
    return { success: false, walletAddress: null, providerName: null, error };
  }
}

/* ================================================================
   Signal Publishing
   ================================================================ */

/**
 * Publish a trading signal with transaction hash proof.
 */
export async function publishSignal(
  input: PublishSignalInput,
): Promise<PublishSignalResult> {
  try {
    // 1. Sign signal message
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `bankr-signals:signal:${input.providerAddress}:${input.action}:${input.token}:${timestamp}`;
    const { signature } = await signWithBankr(input.bankrApiKey, message);

    // 2. Publish to Bankr Signals API
    const response = await fetch(`${BANKR_SIGNALS_API}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: input.providerAddress,
        action: input.action,
        token: input.token,
        entryPrice: input.entryPrice,
        txHash: input.txHash,
        collateralUsd: input.collateralUsd,
        leverage: input.leverage,
        confidence: input.confidence,
        reasoning: input.reasoning,
        stopLossPct: input.stopLossPct,
        takeProfitPct: input.takeProfitPct,
        category: input.category,
        riskLevel: input.riskLevel,
        timeFrame: input.timeFrame,
        tags: input.tags,
        chain: input.chain ?? "base",
        message,
        signature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Signal publish failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const signalId = result.id ?? result.signalId ?? null;

    // 3. Record evidence
    await recordSignalEvidence(input.companyId, input.agentId, "output", {
      action: "bankr_signal_published",
      integration: "bankr-signals",
      signalId,
      providerAddress: input.providerAddress,
      signalAction: input.action,
      token: input.token,
      entryPrice: input.entryPrice,
      txHash: input.txHash,
      collateralUsd: input.collateralUsd,
      leverage: input.leverage,
      confidence: input.confidence,
    });

    return { success: true, signalId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await recordSignalEvidence(input.companyId, input.agentId, "failure", {
      action: "bankr_signal_publish_failed",
      integration: "bankr-signals",
      error,
    });
    return { success: false, signalId: null, error };
  }
}

/* ================================================================
   Signal Closing
   ================================================================ */

/**
 * Close an open signal with exit data.
 */
export async function closeSignal(
  input: CloseSignalInput,
): Promise<CloseSignalResult> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `bankr-signals:signal:${input.providerAddress}:close:${input.token}:${timestamp}`;
    const { signature } = await signWithBankr(input.bankrApiKey, message);

    const response = await fetch(`${BANKR_SIGNALS_API}/signals/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signalId: input.signalId,
        exitPrice: input.exitPrice,
        exitTxHash: input.exitTxHash,
        pnlPct: input.pnlPct,
        pnlUsd: input.pnlUsd,
        message,
        signature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Signal close failed (${response.status}): ${errorText}`);
    }

    await recordSignalEvidence(input.companyId, input.agentId, "output", {
      action: "bankr_signal_closed",
      integration: "bankr-signals",
      signalId: input.signalId,
      exitPrice: input.exitPrice,
      exitTxHash: input.exitTxHash,
      pnlPct: input.pnlPct,
      pnlUsd: input.pnlUsd,
    });

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

/* ================================================================
   Read-Only Endpoints (No Auth Required)
   ================================================================ */

/**
 * Fetch the signal feed.
 */
export async function getSignalFeed(options?: {
  limit?: number;
  since?: string;
}): Promise<SignalFeedEntry[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.since) params.set("since", options.since);

  const url = `${BANKR_SIGNALS_API}/feed${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Feed fetch failed (${response.status})`);
  }

  return response.json();
}

/**
 * Fetch the leaderboard.
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await fetch(`${BANKR_SIGNALS_API}/leaderboard`);

  if (!response.ok) {
    throw new Error(`Leaderboard fetch failed (${response.status})`);
  }

  return response.json();
}

/**
 * Fetch signals for a specific provider.
 */
export async function getProviderSignals(
  providerAddress: string,
  options?: {
    token?: string;
    status?: SignalStatus;
    limit?: number;
  },
): Promise<SignalFeedEntry[]> {
  const params = new URLSearchParams({ provider: providerAddress });
  if (options?.token) params.set("token", options.token);
  if (options?.status) params.set("status", options.status);
  if (options?.limit) params.set("limit", String(options.limit));

  const response = await fetch(`${BANKR_SIGNALS_API}/signals?${params}`);

  if (!response.ok) {
    throw new Error(`Provider signals fetch failed (${response.status})`);
  }

  return response.json();
}

/**
 * Check API health.
 */
export async function checkHealth(): Promise<{ status: string; providers: number; signals: number }> {
  const response = await fetch(`${BANKR_SIGNALS_API}/health`);
  if (!response.ok) throw new Error(`Health check failed (${response.status})`);
  return response.json();
}
