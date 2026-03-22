/**
 * Unified Onchain Execution Orchestrator
 *
 * Central coordinator that wires together all onchain execution modules
 * for the Synthesis hackathon prize tracks:
 *
 *   Track                  | Module                    | Status
 *   ---------------------- | ------------------------- | --------
 *   Protocol Labs ($16K)   | ERC-8004 Registration     | Ready
 *   MetaMask ($5K)         | Delegation Signing        | Ready
 *   Bankr Gateway ($5K)    | LLM Inference + Signals   | Ready
 *   Venice ($11.5K)        | Live Private Inference    | Ready
 *   Uniswap ($5K)          | Swap Execution            | Ready
 *   Celo ($5K)             | Stablecoin Payments       | Ready
 *   ENS                    | Primary Name Registration | Ready
 *
 * The orchestrator provides:
 *   1. A single entry point for each track's key action
 *   2. Evidence collection across all tracks
 *   3. Track readiness assessment
 *   4. Proof pack enrichment for submission
 */

import {
  initiateRegistration,
  confirmRegistration,
  isRegisteredOnChain,
  getOnChainRegistration,
  type RegisterOnChainInput,
  type RegisterOnChainResult,
} from "@/lib/erc8004/register-onchain";

import {
  registerSignalProvider,
  publishSignal,
  closeSignal,
  getSignalFeed,
  getLeaderboard,
  checkHealth as checkBankrSignalsHealth,
  type RegisterProviderInput,
  type PublishSignalInput,
  type CloseSignalInput,
} from "@/lib/bankr/signals";

import { executeBankrInference, type BankrInferenceInput } from "@/lib/bankr/inference-flow";

import {
  executeVeniceLiveStep,
  executeVeniceLiveLoop,
  type VeniceLiveStepInput,
} from "@/lib/venice/live-inference";

import {
  prepareSignedDelegation,
  confirmSignedDelegation,
  buildSignedDelegationChain,
  loadSignedDelegations,
  type SignedDelegationInput,
} from "@/lib/delegations/onchain";

import {
  prepareSwap,
  confirmSwapExecution,
  executeServerSideSwap,
  type ExecuteSwapInput,
} from "@/lib/uniswap/execute-swap";

import {
  prepareCeloPayment,
  confirmCeloPayment,
  executeCeloPaymentViaBankr,
  checkCeloBalance,
  type ExecuteCeloPaymentInput,
} from "@/lib/celo/execute-payment";

import {
  preparePrimaryNameTx,
  confirmPrimaryName,
  loadCompanyENS,
  saveCompanyENSName,
  type SetPrimaryNameInput,
} from "@/lib/ens";

import { supabase } from "@/integrations/supabase/client";

/* ================================================================
   Track Readiness Assessment
   ================================================================ */

export interface TrackReadiness {
  track: string;
  prizeValue: string;
  ready: boolean;
  status: "ready" | "partial" | "not_started";
  details: string;
  evidenceCount: number;
}

/**
 * Assess readiness across all hackathon prize tracks.
 */
export async function assessTrackReadiness(
  companyId: string,
  agentId: string,
): Promise<TrackReadiness[]> {
  // Count evidence logs per integration
  const { data: evidenceLogs } = await supabase
    .from("agent_execution_logs")
    .select("content")
    .eq("company_id", companyId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(500);

  const integrationCounts: Record<string, number> = {};
  for (const log of evidenceLogs ?? []) {
    const content = log.content as Record<string, unknown> | null;
    const integration = (content?.integration as string) ?? "unknown";
    integrationCounts[integration] = (integrationCounts[integration] ?? 0) + 1;
  }

  // Check ERC-8004 registration
  const registered = await isRegisteredOnChain(agentId, companyId);

  // Check ENS
  const ens = await loadCompanyENS(companyId);

  // Check signed delegations
  const delegations = await loadSignedDelegations(companyId);

  return [
    {
      track: "Protocol Labs — ERC-8004 Identity",
      prizeValue: "$16,000",
      ready: registered,
      status: registered ? "ready" : (integrationCounts["erc8004"] ?? 0) > 0 ? "partial" : "not_started",
      details: registered
        ? "Agent registered onchain with ERC-8004 identity"
        : "ERC-8004 registration prepared, needs wallet signing",
      evidenceCount: integrationCounts["erc8004"] ?? 0,
    },
    {
      track: "MetaMask — Delegation Framework",
      prizeValue: "$5,000",
      ready: delegations.length > 0,
      status: delegations.length > 0 ? "ready" : (integrationCounts["metamask-delegations"] ?? 0) > 0 ? "partial" : "not_started",
      details: delegations.length > 0
        ? `${delegations.length} signed delegation(s) with EIP-712 proof`
        : "Delegation framework ready, needs wallet signatures",
      evidenceCount: integrationCounts["metamask-delegations"] ?? 0,
    },
    {
      track: "Bankr — LLM Gateway",
      prizeValue: "$5,000",
      ready: (integrationCounts["bankr"] ?? 0) > 0,
      status: (integrationCounts["bankr"] ?? 0) > 0 ? "ready" : "not_started",
      details: (integrationCounts["bankr"] ?? 0) > 0
        ? `${integrationCounts["bankr"]} inference calls recorded with spend evidence`
        : "Bankr gateway configured, needs API key and inference call",
      evidenceCount: integrationCounts["bankr"] ?? 0,
    },
    {
      track: "Bankr Signals — Trading Signals",
      prizeValue: "$5,000",
      ready: (integrationCounts["bankr-signals"] ?? 0) > 0,
      status: (integrationCounts["bankr-signals"] ?? 0) > 0 ? "ready" : "not_started",
      details: (integrationCounts["bankr-signals"] ?? 0) > 0
        ? "Signal provider registered with published signals"
        : "Bankr Signals API available, needs provider registration",
      evidenceCount: integrationCounts["bankr-signals"] ?? 0,
    },
    {
      track: "Venice — Private Agents",
      prizeValue: "$11,500",
      ready: (integrationCounts["venice"] ?? 0) > 0,
      status: (integrationCounts["venice"] ?? 0) > 0 ? "ready" : "not_started",
      details: (integrationCounts["venice"] ?? 0) > 0
        ? `${integrationCounts["venice"]} private reasoning steps executed via Venice`
        : "Venice client configured, needs API key for live inference",
      evidenceCount: integrationCounts["venice"] ?? 0,
    },
    {
      track: "Uniswap — Agentic Finance",
      prizeValue: "$5,000",
      ready: (integrationCounts["uniswap"] ?? 0) > 0,
      status: (integrationCounts["uniswap"] ?? 0) > 0 ? "ready" : "not_started",
      details: (integrationCounts["uniswap"] ?? 0) > 0
        ? "Swap executed with transaction hash proof"
        : "Uniswap client ready, needs wallet signing for swap execution",
      evidenceCount: integrationCounts["uniswap"] ?? 0,
    },
    {
      track: "Celo — Stablecoin Payments",
      prizeValue: "$5,000",
      ready: (integrationCounts["celo"] ?? 0) > 0,
      status: (integrationCounts["celo"] ?? 0) > 0 ? "ready" : "not_started",
      details: (integrationCounts["celo"] ?? 0) > 0
        ? "Live cUSD/cEUR payment executed with transaction hash"
        : "Celo payment flow prepared, needs wallet signing",
      evidenceCount: integrationCounts["celo"] ?? 0,
    },
    {
      track: "ENS — Primary Name",
      prizeValue: "Bonus",
      ready: ens.ensName !== null,
      status: ens.ensName ? "ready" : "not_started",
      details: ens.ensName
        ? `ENS primary name set: ${ens.ensName} on ${ens.chain}`
        : "ENS available in onboarding, not yet configured",
      evidenceCount: ens.ensName ? 1 : 0,
    },
  ];
}

/* ================================================================
   Proof Pack Enrichment
   ================================================================ */

/**
 * Collect all onchain evidence for the submission proof pack.
 *
 * Returns a structured summary of all onchain activity across
 * every track, suitable for inclusion in the proof pack.
 */
export async function collectOnchainEvidence(
  companyId: string,
  agentId: string,
): Promise<{
  trackReadiness: TrackReadiness[];
  erc8004: Awaited<ReturnType<typeof getOnChainRegistration>>;
  delegations: Awaited<ReturnType<typeof loadSignedDelegations>>;
  ens: Awaited<ReturnType<typeof loadCompanyENS>>;
  totalEvidenceLogs: number;
}> {
  const [trackReadiness, erc8004, delegations, ens] = await Promise.all([
    assessTrackReadiness(companyId, agentId),
    getOnChainRegistration(agentId, companyId),
    loadSignedDelegations(companyId),
    loadCompanyENS(companyId),
  ]);

  const totalEvidenceLogs = trackReadiness.reduce(
    (sum, t) => sum + t.evidenceCount,
    0,
  );

  return {
    trackReadiness,
    erc8004,
    delegations,
    ens,
    totalEvidenceLogs,
  };
}

/* ================================================================
   Re-exports for Convenience
   ================================================================ */

// ERC-8004
export { initiateRegistration, confirmRegistration, isRegisteredOnChain, getOnChainRegistration };
export type { RegisterOnChainInput, RegisterOnChainResult };

// Bankr Signals
export { registerSignalProvider, publishSignal, closeSignal, getSignalFeed, getLeaderboard, checkBankrSignalsHealth };
export type { RegisterProviderInput, PublishSignalInput, CloseSignalInput };

// Bankr Inference
export { executeBankrInference };
export type { BankrInferenceInput };

// Venice
export { executeVeniceLiveStep, executeVeniceLiveLoop };
export type { VeniceLiveStepInput };

// Delegations
export { prepareSignedDelegation, confirmSignedDelegation, buildSignedDelegationChain, loadSignedDelegations };
export type { SignedDelegationInput };

// Uniswap
export { prepareSwap, confirmSwapExecution, executeServerSideSwap };
export type { ExecuteSwapInput };

// Celo
export { prepareCeloPayment, confirmCeloPayment, executeCeloPaymentViaBankr, checkCeloBalance };
export type { ExecuteCeloPaymentInput };

// ENS
export { preparePrimaryNameTx, confirmPrimaryName, loadCompanyENS, saveCompanyENSName };
export type { SetPrimaryNameInput };
