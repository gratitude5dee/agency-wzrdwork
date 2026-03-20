/**
 * x402 Payment Infrastructure — Types
 *
 * TypeScript types for invoices, line items, and payment results
 * used across the x402 payment system.
 */

import type { Database } from "@/integrations/supabase/types";

/** Supabase row type for agent_invoices table */
export type AgentInvoiceRow = Database["public"]["Tables"]["agent_invoices"]["Row"];
export type AgentInvoiceInsert = Database["public"]["Tables"]["agent_invoices"]["Insert"];
export type AgentInvoiceUpdate = Database["public"]["Tables"]["agent_invoices"]["Update"];

/** A single line item on an invoice */
export interface LineItem {
  description: string;
  quantity: number;
  /** Unit price in USDC (human-readable, e.g. "10.50") */
  price: string;
}

/** Application-level invoice type (maps to agent_invoices table) */
export interface Invoice {
  id: string;
  company_id: string;
  agent_id: string | null;
  seller_wallet: string;
  buyer_wallet: string | null;
  description: string;
  line_items: LineItem[];
  /** Total amount in USDC (human-readable, e.g. "100.00") */
  amount_usdc: number;
  paid: boolean;
  tx_hash: string | null;
  /** Arbitrum chain ID = 42161 */
  chain_id: number;
  created_at: string;
  paid_at: string | null;
}

/** Result returned from a payment settlement attempt */
export interface PaymentResult {
  success: boolean;
  /** HTTP status from x402 settlement (200 = success, 402 = payment required) */
  status: number;
  /** Transaction hash if settlement succeeded */
  txHash?: string;
  /** Invoice ID that was paid */
  invoiceId: string;
  /** Amount that was settled in USDC */
  amountUsdc: number;
  /** Error message if settlement failed */
  error?: string;
}
