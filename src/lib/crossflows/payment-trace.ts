/**
 * Payment → Company/Agent/Runtime Trace (VAL-CROSS-004)
 *
 * Given an invoice ID, traces the settlement proof back to:
 * - The owning company
 * - The agent associated with the invoice
 * - Related runs, execution logs, and finance events
 *
 * All artifacts are linked via shared identifiers (company_id,
 * agent_id, invoice_id) so validators and UI can prove payment
 * traceability without hidden manual correlation.
 */

import { supabase } from "@/integrations/supabase/client";

/* ================================================================
   Types
   ================================================================ */

export interface PaymentTrace {
  /** The invoice being traced */
  invoice: {
    id: string;
    company_id: string;
    agent_id: string | null;
    seller_wallet: string;
    buyer_wallet: string | null;
    amount_usdc: number;
    paid: boolean;
    tx_hash: string | null;
    chain_id: number;
    paid_at: string | null;
    description: string | null;
  } | null;

  /** The company that owns this invoice */
  company: {
    id: string;
    name: string;
    slug: string;
    wallet_address: string | null;
  } | null;

  /** The agent associated with the invoice (if any) */
  agent: {
    id: string;
    name: string;
    role: string | null;
    company_id: string;
  } | null;

  /** Runs by the same agent for the same company (runtime artifacts) */
  relatedRuns: Array<{
    id: string;
    agent_id: string;
    company_id: string;
    status: string;
    summary: string | null;
    created_at: string;
  }>;

  /** Execution logs for the agent's runs (log artifacts) */
  relatedLogs: Array<{
    id: string;
    agent_id: string;
    company_id: string;
    run_id: string;
    log_type: string;
    created_at: string;
  }>;

  /** Whether the trace forms a coherent link from payment → company → agent → runtime */
  coherent: boolean;

  /** Specific traceability violations */
  violations: string[];
}

/* ================================================================
   Trace Function
   ================================================================ */

/**
 * Trace a payment (invoice) back to its owning company, agent,
 * and related runtime artifacts.
 *
 * Follows the chain:
 *   invoice.company_id → companies
 *   invoice.agent_id → agents
 *   invoice.agent_id + company_id → runs
 *   runs.id → agent_execution_logs
 *
 * Validates that all linked artifacts share coherent identifiers.
 */
export async function tracePayment(invoiceId: string): Promise<PaymentTrace> {
  const violations: string[] = [];

  // 1. Fetch the invoice
  const { data: invoice } = await supabase
    .from("agent_invoices")
    .select(
      "id, company_id, agent_id, seller_wallet, buyer_wallet, amount_usdc, paid, tx_hash, chain_id, paid_at, description",
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) {
    return {
      invoice: null,
      company: null,
      agent: null,
      relatedRuns: [],
      relatedLogs: [],
      coherent: false,
      violations: [`Invoice ${invoiceId} not found`],
    };
  }

  // 2. Fetch the owning company
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, wallet_address")
    .eq("id", invoice.company_id)
    .maybeSingle();

  if (!company) {
    violations.push(`Company ${invoice.company_id} not found for invoice ${invoiceId}`);
  } else if (company.id !== invoice.company_id) {
    violations.push(
      `Company ID mismatch: invoice says ${invoice.company_id}, company record says ${company.id}`,
    );
  }

  // 3. Fetch the agent (if linked)
  let agent: PaymentTrace["agent"] = null;
  if (invoice.agent_id) {
    const { data: agentData } = await supabase
      .from("agents")
      .select("id, name, role, company_id")
      .eq("id", invoice.agent_id)
      .maybeSingle();

    if (!agentData) {
      violations.push(`Agent ${invoice.agent_id} not found for invoice ${invoiceId}`);
    } else {
      agent = agentData;
      if (agentData.company_id !== invoice.company_id) {
        violations.push(
          `Agent ${agentData.id} belongs to company ${agentData.company_id}, ` +
            `but invoice ${invoiceId} belongs to company ${invoice.company_id}`,
        );
      }
    }
  }

  // 4. Fetch runs by the same agent and company
  let relatedRuns: PaymentTrace["relatedRuns"] = [];
  if (invoice.agent_id) {
    const { data: runs = [] } = await supabase
      .from("runs")
      .select("id, agent_id, company_id, status, summary, created_at")
      .eq("agent_id", invoice.agent_id)
      .eq("company_id", invoice.company_id)
      .order("created_at", { ascending: false });
    relatedRuns = (runs ?? []).slice(0, 10);

    // Validate run company_id coherence
    for (const run of relatedRuns) {
      if (run.company_id !== invoice.company_id) {
        violations.push(
          `Run ${run.id} has company_id ${run.company_id}, expected ${invoice.company_id}`,
        );
      }
    }
  }

  // 5. Fetch execution logs for the runs
  const runIds = relatedRuns.map((r) => r.id);
  let relatedLogs: PaymentTrace["relatedLogs"] = [];
  if (runIds.length > 0) {
    const { data: logs = [] } = await supabase
      .from("agent_execution_logs")
      .select("id, agent_id, company_id, run_id, log_type, created_at")
      .in("run_id", runIds)
      .order("created_at", { ascending: false });
    relatedLogs = (logs ?? []).slice(0, 50);
  }

  return {
    invoice,
    company,
    agent,
    relatedRuns,
    relatedLogs,
    coherent: violations.length === 0,
    violations,
  };
}
