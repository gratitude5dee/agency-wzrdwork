/**
 * x402 Payment Infrastructure — Settlement Validation
 *
 * Pure settlement validation and persistence logic for the x402 payment protocol.
 * This module validates invoice economics, records payer proof, and rejects
 * invalid or repeated settlements.
 *
 * Used by:
 * - The server-side edge function (`supabase/functions/x402-settle`)
 * - Unit tests that exercise settlement logic without a real server
 *
 * ⚠️  IMPORTANT — NEVER USE DIRECTLY IN BROWSER
 * Settlement secrets (thirdweb secret key, service-role key) must stay server-side.
 * Browser code should call the settlement client (`settlement-client.ts`) which
 * invokes the edge function.
 */

import { supabase } from "@/integrations/supabase/client";
import type { AgentInvoiceRow } from "./types";

/** Proof payload submitted by the payer */
export interface SettlementProof {
  /** Invoice UUID */
  invoiceId: string;
  /** Payer's wallet address */
  payerWallet: string;
  /** On-chain transaction hash */
  txHash: string;
  /** Amount paid in USDC (human-readable, e.g. 25.00) */
  amountUsdc: number;
  /** Chain ID the payment was made on */
  chainId: number;
  /** Recipient wallet that received the payment */
  recipientWallet: string;
}

/** Result returned from settlement validation */
export interface SettlementResult {
  success: boolean;
  /** HTTP-style status code */
  status: number;
  /** Invoice ID that was settled (or attempted) */
  invoiceId: string;
  /** Amount from the invoice in USDC */
  amountUsdc: number;
  /** Transaction hash if settlement succeeded */
  txHash?: string;
  /** Paid timestamp if settlement succeeded */
  paidAt?: string;
  /** Error message if settlement failed */
  error?: string;
}

/**
 * Validate settlement proof against invoice economics.
 *
 * Checks:
 * 1. Invoice exists
 * 2. Invoice is not already paid (idempotency)
 * 3. Payment amount matches invoice amount
 * 4. Chain ID matches invoice chain
 * 5. Recipient wallet matches invoice seller
 * 6. Proof fields (txHash, payerWallet) are present
 *
 * On success, marks the invoice as paid with buyer_wallet, tx_hash, and paid_at.
 */
export async function validateAndSettleInvoice(
  proof: SettlementProof,
): Promise<SettlementResult> {
  const { invoiceId, payerWallet, txHash, amountUsdc, chainId, recipientWallet } = proof;

  // 1. Validate proof fields are present
  if (!txHash || !payerWallet) {
    return {
      success: false,
      status: 402,
      invoiceId,
      amountUsdc: 0,
      error: "Missing payment proof: txHash and payerWallet are required",
    };
  }

  // 2. Fetch the invoice
  const { data: invoice, error: fetchError } = await supabase
    .from("agent_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (fetchError) {
    return {
      success: false,
      status: 500,
      invoiceId,
      amountUsdc: 0,
      error: `Failed to fetch invoice: ${fetchError.message}`,
    };
  }

  if (!invoice) {
    return {
      success: false,
      status: 404,
      invoiceId,
      amountUsdc: 0,
      error: "Invoice not found",
    };
  }

  // 3. Check idempotency — already paid
  if (invoice.paid) {
    return {
      success: false,
      status: 409,
      invoiceId,
      amountUsdc: invoice.amount_usdc,
      error: "Invoice already paid — duplicate settlement rejected",
    };
  }

  // 4. Validate amount matches
  if (amountUsdc !== invoice.amount_usdc) {
    return {
      success: false,
      status: 422,
      invoiceId,
      amountUsdc: invoice.amount_usdc,
      error: `Amount mismatch: proof says ${amountUsdc} USDC but invoice requires ${invoice.amount_usdc} USDC`,
    };
  }

  // 5. Validate chain ID matches
  if (chainId !== invoice.chain_id) {
    return {
      success: false,
      status: 422,
      invoiceId,
      amountUsdc: invoice.amount_usdc,
      error: `Chain mismatch: proof says chain ${chainId} but invoice requires chain ${invoice.chain_id}`,
    };
  }

  // 6. Validate recipient wallet matches seller
  if (recipientWallet.toLowerCase() !== invoice.seller_wallet.toLowerCase()) {
    return {
      success: false,
      status: 422,
      invoiceId,
      amountUsdc: invoice.amount_usdc,
      error: `Recipient mismatch: proof says ${recipientWallet} but invoice seller is ${invoice.seller_wallet}`,
    };
  }

  // 7. Mark invoice as paid with full proof
  const paidAt = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("agent_invoices")
    .update({
      paid: true,
      tx_hash: txHash,
      buyer_wallet: payerWallet,
      paid_at: paidAt,
    })
    .eq("id", invoiceId)
    .eq("paid", false) // Optimistic lock: only update if still unpaid
    .select()
    .single();

  if (updateError || !updated) {
    // If the optimistic lock failed, another settlement beat us
    return {
      success: false,
      status: 409,
      invoiceId,
      amountUsdc: invoice.amount_usdc,
      error: "Settlement race condition — invoice was paid by another request",
    };
  }

  return {
    success: true,
    status: 200,
    invoiceId,
    amountUsdc: updated.amount_usdc,
    txHash: updated.tx_hash ?? undefined,
    paidAt: updated.paid_at ?? undefined,
  };
}

/**
 * Fetch an invoice with its full settlement state for display.
 */
export async function getInvoiceSettlementState(
  invoiceId: string,
): Promise<AgentInvoiceRow | null> {
  const { data, error } = await supabase
    .from("agent_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch invoice settlement state: ${error.message}`);
  }

  return data;
}
