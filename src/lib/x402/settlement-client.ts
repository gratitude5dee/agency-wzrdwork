/**
 * x402 Payment Infrastructure — Settlement Client (Browser-Safe)
 *
 * Client-side module that invokes the server-side settlement edge function.
 * This module NEVER handles settlement secrets — all secret-bearing logic
 * runs in the `x402-settle` Supabase edge function.
 *
 * Uses the existing Supabase client's `functions.invoke()` which handles
 * auth headers and API key routing automatically.
 *
 * Usage:
 *   import { submitSettlement } from "@/lib/x402/settlement-client";
 *   const result = await submitSettlement({ invoiceId, payerWallet, txHash, ... });
 */

import { supabase } from "@/integrations/supabase/client";
import type { SettlementProof, SettlementResult } from "./settlement";

/**
 * Submit a settlement proof to the server-side x402-settle edge function.
 *
 * The browser sends the proof payload; the edge function validates it
 * against the invoice record and marks it paid if valid.
 *
 * @param proof - Settlement proof with invoice ID, payer wallet, tx hash,
 *                amount, chain, and recipient
 * @returns SettlementResult from the server
 */
export async function submitSettlement(
  proof: SettlementProof,
): Promise<SettlementResult> {
  try {
    const { data, error } = await supabase.functions.invoke("x402-settle", {
      body: proof,
    });

    if (error) {
      return {
        success: false,
        status: 500,
        invoiceId: proof.invoiceId,
        amountUsdc: proof.amountUsdc,
        error: `Settlement request failed: ${error.message}`,
      };
    }

    return data as SettlementResult;
  } catch (error) {
    return {
      success: false,
      status: 500,
      invoiceId: proof.invoiceId,
      amountUsdc: proof.amountUsdc,
      error: `Settlement request failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
