/**
 * Submission Proof Pack — Retrieval & Assembly
 *
 * Aggregates all proof artifacts needed for hackathon submission:
 * - Agent manifest (agent.json) — from ERC-8004 identity
 * - Run log (agent_log.json) — from execution logs
 * - Payment evidence — from x402 invoices
 * - Route matrix — all navigable product routes
 *
 * This module fulfils VAL-CROSS-006 by providing self-contained,
 * README-backed retrieval for every proof artifact without relying
 * on unpublished operator knowledge.
 */

import { supabase } from "@/integrations/supabase/client";
import { getAgentManifestJson, getRunLogJson } from "@/lib/erc8004/download";
import type { AgentManifestDownload } from "@/lib/erc8004/download";
import type { RunLogExport } from "@/lib/erc8004/execution-log";

/* ================================================================
   Route Matrix
   ================================================================ */

export interface RouteEntry {
  path: string;
  label: string;
  section: string;
}

/** All navigable routes in the product, matching left-nav + AppShell routes */
export const ROUTE_MATRIX: RouteEntry[] = [
  { path: "/cockpit", label: "Sandbox", section: "Top" },
  { path: "/dashboard", label: "Dashboard", section: "Top" },
  { path: "/inbox", label: "Inbox", section: "Top" },
  { path: "/chat", label: "Chat", section: "Top" },
  { path: "/issues", label: "Issues", section: "Work" },
  { path: "/goals", label: "Goals", section: "Work" },
  { path: "/approvals", label: "Approvals", section: "Work" },
  { path: "/projects", label: "Projects", section: "Work" },
  { path: "/agents", label: "All Agents", section: "Agents" },
  { path: "/agents/new", label: "New Agent", section: "Agents" },
  { path: "/org-chart", label: "Org Chart", section: "Company" },
  { path: "/skills", label: "Skills", section: "Company" },
  { path: "/delegations", label: "Delegations", section: "Company" },
  { path: "/costs", label: "Costs", section: "Company" },
  { path: "/budgets", label: "Budgets & Quotas", section: "Company" },
  { path: "/activity", label: "Activity", section: "Company" },
  { path: "/integrations", label: "Integrations", section: "Company" },
  { path: "/plugins", label: "Plugins", section: "Company" },
  { path: "/documents", label: "Documents", section: "Company" },
  { path: "/workspaces", label: "Workspaces", section: "Company" },
  { path: "/submission-proof", label: "Submission Proof", section: "Company" },
  { path: "/invites", label: "Invites & Settings", section: "Company" },
  { path: "/settings", label: "Settings", section: "Company" },
];

/* ================================================================
   Payment Evidence
   ================================================================ */

export interface PaymentEvidence {
  id: string;
  company_id: string;
  agent_id: string | null;
  seller_wallet: string;
  buyer_wallet: string | null;
  amount_usdc: number;
  paid: boolean;
  tx_hash: string | null;
  chain_id: number;
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

/**
 * Retrieve payment evidence for a company.
 * Returns the most recent invoices (up to limit) with their settlement state.
 */
export async function getPaymentEvidence(
  companyId: string,
  limit = 10,
): Promise<PaymentEvidence[]> {
  const { data, error } = await supabase
    .from("agent_invoices")
    .select(
      "id, company_id, agent_id, seller_wallet, buyer_wallet, amount_usdc, paid, tx_hash, chain_id, description, paid_at, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch payment evidence: ${error.message}`);
  }

  return data ?? [];
}

/* ================================================================
   Proof Pack Assembly
   ================================================================ */

export interface ProofPack {
  /** Company ID for the proof pack */
  companyId: string;

  /** Agent manifest (agent.json) — null if no agent found */
  manifest: AgentManifestDownload | null;
  manifestError: string | null;

  /** Run log (agent_log.json) — null if no run found */
  runLog: RunLogExport | null;
  runLogError: string | null;

  /** Payment evidence — list of invoices for the company */
  payments: PaymentEvidence[];
  paymentsError: string | null;

  /** Route matrix showing all navigable product routes */
  routeMatrix: RouteEntry[];

  /** Timestamp when the proof pack was assembled */
  assembledAt: string;
}

/**
 * Assemble the full submission proof pack for a company.
 *
 * Retrieves each artifact independently so partial failures
 * don't block other artifacts from being included.
 *
 * @param companyId - The active company ID
 * @param agentId - Optional agent ID for manifest retrieval
 * @param runId - Optional run ID for log retrieval
 */
export async function assembleProofPack(
  companyId: string,
  agentId?: string | null,
  runId?: string | null,
): Promise<ProofPack> {
  const pack: ProofPack = {
    companyId,
    manifest: null,
    manifestError: null,
    runLog: null,
    runLogError: null,
    payments: [],
    paymentsError: null,
    routeMatrix: ROUTE_MATRIX,
    assembledAt: new Date().toISOString(),
  };

  // 1. Agent manifest
  if (agentId) {
    try {
      pack.manifest = await getAgentManifestJson(agentId);
    } catch (err) {
      pack.manifestError =
        err instanceof Error ? err.message : "Failed to retrieve manifest";
    }
  } else {
    pack.manifestError = "No agent selected for manifest retrieval";
  }

  // 2. Run log
  if (runId) {
    try {
      pack.runLog = await getRunLogJson(runId);
    } catch (err) {
      pack.runLogError =
        err instanceof Error ? err.message : "Failed to retrieve run log";
    }
  } else {
    pack.runLogError = "No run selected for log retrieval";
  }

  // 3. Payment evidence
  try {
    pack.payments = await getPaymentEvidence(companyId);
  } catch (err) {
    pack.paymentsError =
      err instanceof Error ? err.message : "Failed to retrieve payment evidence";
  }

  return pack;
}
