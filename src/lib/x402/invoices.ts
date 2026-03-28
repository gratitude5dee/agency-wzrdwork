/**
 * x402 Payment Infrastructure — Invoice CRUD
 *
 * Supabase-backed functions for creating, reading, and updating
 * invoices in the agent_invoices table.
 */

import { supabase } from "@/integrations/supabase/client";
import { ARBITRUM_CHAIN_ID } from "./constants";
import type { LineItem, Invoice, AgentInvoiceRow } from "./types";
import type { Json } from "@/integrations/supabase/types";

/**
 * Create a new invoice in the agent_invoices table.
 *
 * @param companyId  - The company UUID
 * @param agentId    - The agent UUID (nullable)
 * @param sellerWallet - The seller's wallet address
 * @param description  - Human-readable invoice description
 * @param lineItems    - Array of line items
 * @param amountUsdc   - Total amount in USDC
 * @returns The newly created invoice row
 */
export async function createInvoice(
  companyId: string,
  agentId: string | null,
  sellerWallet: string,
  description: string,
  lineItems: LineItem[],
  amountUsdc: number,
): Promise<AgentInvoiceRow> {
  const { data, error } = await supabase
    .from("agent_invoices")
    .insert({
      company_id: companyId,
      agent_id: agentId,
      seller_wallet: sellerWallet,
      description,
      line_items: lineItems as unknown as Json,
      amount_usdc: amountUsdc,
      paid: false,
      tx_hash: null,
      chain_id: ARBITRUM_CHAIN_ID,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create invoice: ${error?.message ?? "unknown error"}`);
  }

  return data;
}

/**
 * Fetch a single invoice by ID.
 */
export async function getInvoice(id: string): Promise<AgentInvoiceRow | null> {
  const { data, error } = await supabase
    .from("agent_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch invoice ${id}: ${error.message}`);
  }

  return data;
}

/**
 * List all invoices for a given company, newest first.
 */
export async function listInvoices(companyId: string): Promise<AgentInvoiceRow[]> {
  const { data, error } = await supabase
    .from("agent_invoices")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list invoices: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Mark an invoice as paid and record the transaction hash.
 *
 * @param id     - Invoice UUID
 * @param txHash - On-chain transaction hash
 * @returns The updated invoice row
 */
export async function updateInvoicePayment(
  id: string,
  txHash: string,
): Promise<AgentInvoiceRow> {
  const { data, error } = await supabase
    .from("agent_invoices")
    .update({
      paid: true,
      tx_hash: txHash,
      paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update invoice payment ${id}: ${error?.message ?? "unknown error"}`);
  }

  return data;
}
