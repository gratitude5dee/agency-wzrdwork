/**
 * useComposioConfig — company-scoped Composio integration configuration.
 *
 * Reads the "composio" integration row from the `integrations` table for the
 * active company and exposes its enabled state, consumer key, MCP URL, and
 * selected tools.
 *
 * Also provides a mutation to save/update Composio configuration.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import type { Database as DB } from "@/integrations/supabase/types";

type IntegrationRow = DB["public"]["Tables"]["integrations"]["Row"];

export const COMPOSIO_INTEGRATION_KEY = "composio";
export const COMPOSIO_DEFAULT_MCP_URL = "https://connect.composio.dev/mcp";

export interface ComposioConfig {
  enabled: boolean;
  consumerKey: string;
  mcpUrl: string;
  selectedTools: string[];
}

function parseComposioConfig(row: IntegrationRow | null): ComposioConfig {
  if (!row) {
    return {
      enabled: false,
      consumerKey: "",
      mcpUrl: COMPOSIO_DEFAULT_MCP_URL,
      selectedTools: [],
    };
  }

  const config = (row.config ?? {}) as Record<string, unknown>;
  return {
    enabled: row.enabled ?? false,
    consumerKey: typeof config.consumer_key === "string" ? config.consumer_key : "",
    mcpUrl: typeof config.mcp_url === "string" ? config.mcp_url : COMPOSIO_DEFAULT_MCP_URL,
    selectedTools: Array.isArray(config.selected_tools)
      ? (config.selected_tools as string[]).filter((t) => typeof t === "string")
      : [],
  };
}

export function useComposioConfig() {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  const queryKey = ["composio-config", companyId] as const;

  const { data: config, isLoading } = useQuery<ComposioConfig>({
    queryKey,
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", companyId!)
        .eq("integration_key", COMPOSIO_INTEGRATION_KEY)
        .maybeSingle();

      if (error) throw error;
      return parseComposioConfig(data as IntegrationRow | null);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (update: Partial<ComposioConfig>) => {
      if (!companyId) throw new Error("No company found");

      const current = config ?? {
        enabled: false,
        consumerKey: "",
        mcpUrl: COMPOSIO_DEFAULT_MCP_URL,
        selectedTools: [],
      };

      const merged = { ...current, ...update };

      const configPayload = {
        consumer_key: merged.consumerKey,
        mcp_url: merged.mcpUrl,
        selected_tools: merged.selectedTools,
      };

      // Check if row already exists
      const { data: existing } = await supabase
        .from("integrations")
        .select("id")
        .eq("company_id", companyId)
        .eq("integration_key", COMPOSIO_INTEGRATION_KEY)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("integrations")
          .update({ enabled: merged.enabled, config: configPayload })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          company_id: companyId,
          integration_key: COMPOSIO_INTEGRATION_KEY,
          name: "Composio",
          enabled: merged.enabled,
          config: configPayload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
    },
  });

  return {
    config: config ?? {
      enabled: false,
      consumerKey: "",
      mcpUrl: COMPOSIO_DEFAULT_MCP_URL,
      selectedTools: [],
    },
    isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
