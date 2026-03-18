/**
 * x402-settle — Server-Side Invoice Settlement Edge Function
 *
 * Receives a settlement proof from the browser client, validates the proof
 * against the invoice's economics (amount, chain, recipient), records the
 * payer wallet and tx hash on success, and rejects invalid or repeated
 * settlements.
 *
 * ⚠️  SECRET-BEARING — runs server-side only.
 * The browser never sees the Supabase service-role key used here.
 *
 * Request body (JSON):
 *   {
 *     invoiceId: string;
 *     payerWallet: string;
 *     txHash: string;
 *     amountUsdc: number;
 *     chainId: number;
 *     recipientWallet: string;
 *   }
 *
 * Response (JSON):
 *   {
 *     success: boolean;
 *     status: number;
 *     invoiceId: string;
 *     amountUsdc: number;
 *     txHash?: string;
 *     paidAt?: string;
 *     error?: string;
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SettlementProof {
  invoiceId: string;
  payerWallet: string;
  txHash: string;
  amountUsdc: number;
  chainId: number;
  recipientWallet: string;
}

interface SettlementResult {
  success: boolean;
  status: number;
  invoiceId: string;
  amountUsdc: number;
  txHash?: string;
  paidAt?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Parse the settlement proof
    const proof: SettlementProof = await req.json();

    // Validate required fields
    if (!proof.invoiceId || !proof.payerWallet || !proof.txHash) {
      const result: SettlementResult = {
        success: false,
        status: 402,
        invoiceId: proof.invoiceId ?? "",
        amountUsdc: 0,
        error:
          "Missing payment proof: invoiceId, payerWallet, and txHash are required",
      };
      return new Response(JSON.stringify(result), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      typeof proof.amountUsdc !== "number" ||
      typeof proof.chainId !== "number"
    ) {
      const result: SettlementResult = {
        success: false,
        status: 422,
        invoiceId: proof.invoiceId,
        amountUsdc: 0,
        error: "Invalid proof: amountUsdc and chainId must be numbers",
      };
      return new Response(JSON.stringify(result), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!proof.recipientWallet) {
      const result: SettlementResult = {
        success: false,
        status: 422,
        invoiceId: proof.invoiceId,
        amountUsdc: 0,
        error: "Invalid proof: recipientWallet is required",
      };
      return new Response(JSON.stringify(result), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a Supabase client with the service-role key for trusted DB access
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({
          success: false,
          status: 500,
          invoiceId: proof.invoiceId,
          amountUsdc: 0,
          error: "Server configuration error: missing Supabase credentials",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch the invoice
    const { data: invoice, error: fetchError } = await supabase
      .from("agent_invoices")
      .select("*")
      .eq("id", proof.invoiceId)
      .maybeSingle();

    if (fetchError) {
      const result: SettlementResult = {
        success: false,
        status: 500,
        invoiceId: proof.invoiceId,
        amountUsdc: 0,
        error: `Failed to fetch invoice: ${fetchError.message}`,
      };
      return new Response(JSON.stringify(result), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invoice) {
      const result: SettlementResult = {
        success: false,
        status: 404,
        invoiceId: proof.invoiceId,
        amountUsdc: 0,
        error: "Invoice not found",
      };
      return new Response(JSON.stringify(result), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check idempotency — already paid
    if (invoice.paid) {
      const result: SettlementResult = {
        success: false,
        status: 409,
        invoiceId: proof.invoiceId,
        amountUsdc: invoice.amount_usdc,
        error: "Invoice already paid — duplicate settlement rejected",
      };
      return new Response(JSON.stringify(result), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Validate amount matches
    if (proof.amountUsdc !== invoice.amount_usdc) {
      const result: SettlementResult = {
        success: false,
        status: 422,
        invoiceId: proof.invoiceId,
        amountUsdc: invoice.amount_usdc,
        error: `Amount mismatch: proof says ${proof.amountUsdc} USDC but invoice requires ${invoice.amount_usdc} USDC`,
      };
      return new Response(JSON.stringify(result), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Validate chain ID matches
    if (proof.chainId !== invoice.chain_id) {
      const result: SettlementResult = {
        success: false,
        status: 422,
        invoiceId: proof.invoiceId,
        amountUsdc: invoice.amount_usdc,
        error: `Chain mismatch: proof says chain ${proof.chainId} but invoice requires chain ${invoice.chain_id}`,
      };
      return new Response(JSON.stringify(result), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Validate recipient wallet matches seller
    if (
      proof.recipientWallet.toLowerCase() !==
      invoice.seller_wallet.toLowerCase()
    ) {
      const result: SettlementResult = {
        success: false,
        status: 422,
        invoiceId: proof.invoiceId,
        amountUsdc: invoice.amount_usdc,
        error: `Recipient mismatch: proof says ${proof.recipientWallet} but invoice seller is ${invoice.seller_wallet}`,
      };
      return new Response(JSON.stringify(result), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Mark invoice as paid with full proof (optimistic lock on paid=false)
    const paidAt = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("agent_invoices")
      .update({
        paid: true,
        tx_hash: proof.txHash,
        buyer_wallet: proof.payerWallet,
        paid_at: paidAt,
      })
      .eq("id", proof.invoiceId)
      .eq("paid", false)
      .select()
      .single();

    if (updateError || !updated) {
      const result: SettlementResult = {
        success: false,
        status: 409,
        invoiceId: proof.invoiceId,
        amountUsdc: invoice.amount_usdc,
        error:
          "Settlement race condition — invoice was paid by another request",
      };
      return new Response(JSON.stringify(result), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Success
    const result: SettlementResult = {
      success: true,
      status: 200,
      invoiceId: updated.id,
      amountUsdc: updated.amount_usdc,
      txHash: updated.tx_hash ?? undefined,
      paidAt: updated.paid_at ?? undefined,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        status: 500,
        invoiceId: "",
        amountUsdc: 0,
        error: `Internal server error: ${error instanceof Error ? error.message : "unknown"}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
