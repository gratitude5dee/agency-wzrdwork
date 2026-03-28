/**
 * x402 Payment Infrastructure — Settlement
 *
 * Wrapper around thirdweb's x402 `settlePayment` and `facilitator`
 * functions, configured for Arbitrum USDC.
 *
 * ⚠️  IMPORTANT — SERVER-SIDE ONLY
 * ─────────────────────────────────
 * The `settlePayment` function requires a `secretKey` for the thirdweb
 * client and a server wallet address. These credentials must NEVER be
 * exposed in a browser (Vite SPA) bundle.
 *
 * In production, this module should run inside a server-side endpoint
 * (e.g. Next.js API route, Express, Cloudflare Worker) that receives
 * the x-payment header from the client and calls `settleInvoicePayment`
 * with the server-side secret key.
 *
 * The functions are exported so that:
 * 1. The TypeScript types compile correctly in the SPA build.
 * 2. A future server component can import and use them directly.
 * 3. Tests can exercise the wiring logic without a real secret key.
 */

import { settlePayment, facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { arbitrum } from "thirdweb/chains";
import { USDC_TOKEN_ADDRESS, USDC_DECIMALS, usdcToSmallestUnit } from "./constants";
import { getInvoice, updateInvoicePayment } from "./invoices";
import type { PaymentResult } from "./types";

/**
 * Create a thirdweb facilitator configured for Arbitrum USDC settlement.
 *
 * @param secretKey        - thirdweb secret key (server-side only!)
 * @param serverWalletAddress - wallet address that settles payments
 */
export function createX402Facilitator(
  secretKey: string,
  serverWalletAddress: string,
) {
  const client = createThirdwebClient({ secretKey });

  return facilitator({
    client,
    serverWalletAddress,
  });
}

/**
 * Settle a payment for an invoice using the x402 protocol.
 *
 * This function:
 * 1. Fetches the invoice from Supabase.
 * 2. Validates it has not already been paid.
 * 3. Calls thirdweb's `settlePayment` with the invoice amount in USDC
 *    on the Arbitrum chain.
 * 4. If successful, marks the invoice as paid.
 *
 * @param invoiceId           - The invoice UUID
 * @param paymentData         - The x-payment header value from the client
 * @param resourceUrl         - The URL of the resource being paid for
 * @param secretKey           - thirdweb secret key (server-side only)
 * @param serverWalletAddress - wallet that receives settlement
 * @returns PaymentResult
 */
export async function settleInvoicePayment(
  invoiceId: string,
  paymentData: string | undefined,
  resourceUrl: string,
  secretKey: string,
  serverWalletAddress: string,
): Promise<PaymentResult> {
  // 1. Fetch the invoice (amount from DB prevents tampering)
  const invoice = await getInvoice(invoiceId);
  if (!invoice) {
    return {
      success: false,
      status: 404,
      invoiceId,
      amountUsdc: 0,
      error: "Invoice not found",
    };
  }

  if (invoice.paid) {
    return {
      success: false,
      status: 400,
      invoiceId,
      amountUsdc: invoice.amount_usdc,
      error: "Invoice already paid",
    };
  }

  // 2. Build the facilitator
  const thirdwebFacilitator = createX402Facilitator(secretKey, serverWalletAddress);

  // Use the seller wallet from the invoice
  const payTo = invoice.seller_wallet;

  // 3. Settle via thirdweb x402
  const result = await settlePayment({
    resourceUrl,
    method: "GET",
    paymentData: paymentData ?? undefined,
    payTo,
    network: arbitrum,
    price: {
      amount: usdcToSmallestUnit(invoice.amount_usdc),
      asset: {
        address: USDC_TOKEN_ADDRESS,
        decimals: USDC_DECIMALS,
      },
    },
    facilitator: thirdwebFacilitator,
    routeConfig: {
      description: `Payment for invoice ${invoiceId}`,
      mimeType: "application/json",
    },
  });

  // 4. Handle the result
  if (result.status === 200) {
    // Extract tx hash from receipt if available
    const txHash =
      "paymentReceipt" in result && result.paymentReceipt
        ? (result.paymentReceipt as Record<string, unknown>).txHash as string ?? ""
        : "";

    await updateInvoicePayment(invoiceId, txHash);

    return {
      success: true,
      status: 200,
      txHash,
      invoiceId,
      amountUsdc: invoice.amount_usdc,
    };
  }

  // 402 — Payment required (client needs to provide payment proof)
  return {
    success: false,
    status: 402,
    invoiceId,
    amountUsdc: invoice.amount_usdc,
    error: "Payment required — client must provide a valid x-payment header",
  };
}
