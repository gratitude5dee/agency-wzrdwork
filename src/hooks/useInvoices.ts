/**
 * React Query hooks for invoice CRUD operations.
 *
 * Provides query and mutation hooks for the agent_invoices table,
 * backed by the x402 invoice module.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  updateInvoicePayment,
} from "@/lib/x402/invoices";
import type { LineItem } from "@/lib/x402/types";

/* ----------------------------------------------------------------
   Query Hooks
   ---------------------------------------------------------------- */

/** Fetch a single invoice by ID */
export function useInvoice(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => getInvoice(invoiceId!),
    enabled: !!invoiceId,
  });
}

/** List all invoices for a company */
export function useInvoices(companyId: string | undefined) {
  return useQuery({
    queryKey: ["invoices", companyId],
    queryFn: () => listInvoices(companyId!),
    enabled: !!companyId,
  });
}

/* ----------------------------------------------------------------
   Mutation Hooks
   ---------------------------------------------------------------- */

/** Create a new invoice */
export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      companyId: string;
      agentId: string | null;
      sellerWallet: string;
      description: string;
      lineItems: LineItem[];
      amountUsdc: number;
    }) => {
      return createInvoice(
        params.companyId,
        params.agentId,
        params.sellerWallet,
        params.description,
        params.lineItems,
        params.amountUsdc,
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices", variables.companyId] });
    },
  });
}

/** Mark an invoice as paid with a transaction hash */
export function useUpdateInvoicePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { invoiceId: string; txHash: string }) => {
      return updateInvoicePayment(params.invoiceId, params.txHash);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", data.id] });
      queryClient.invalidateQueries({ queryKey: ["invoices", data.company_id] });
    },
  });
}
