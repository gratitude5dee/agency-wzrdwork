/**
 * React Query hook for x402 invoice settlement.
 *
 * Provides a mutation hook that submits settlement proof to the
 * server-side x402-settle edge function. The browser never handles
 * settlement secrets directly.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { submitSettlement } from "@/lib/x402/settlement-client";
import type { SettlementProof } from "@/lib/x402/settlement";

/**
 * Hook to settle an invoice through the server-side x402 surface.
 *
 * On success, invalidates the relevant invoice queries so the UI
 * reflects the paid state immediately.
 */
export function useSettleInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (proof: SettlementProof) => {
      const result = await submitSettlement(proof);

      // Throw on failure so React Query treats it as an error
      if (!result.success) {
        const error = new Error(result.error ?? "Settlement failed");
        (error as Error & { settlementResult: typeof result }).settlementResult = result;
        throw error;
      }

      return result;
    },
    onSuccess: (_data, variables) => {
      // Invalidate invoice queries to refresh the paid state
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.invoiceId] });
      // Also invalidate the company-level invoice list
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
