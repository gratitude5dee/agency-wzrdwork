/**
 * x402 Payment Infrastructure — Public API
 *
 * Re-exports the main functions and types used by the rest of the app.
 */

export {
  USDC_TOKEN_ADDRESS,
  USDC_DECIMALS,
  ARBITRUM_CHAIN_ID,
  usdcToSmallestUnit,
  smallestUnitToUsdc,
} from "./constants";

export {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoicePayment,
} from "./invoices";

export {
  createX402Facilitator,
  settleInvoicePayment,
} from "./payment";

export {
  validateAndSettleInvoice,
  getInvoiceSettlementState,
} from "./settlement";

export {
  submitSettlement,
} from "./settlement-client";

export type {
  Invoice,
  LineItem,
  PaymentResult,
  AgentInvoiceRow,
  AgentInvoiceInsert,
  AgentInvoiceUpdate,
} from "./types";

export type {
  SettlementProof,
  SettlementResult,
} from "./settlement";
