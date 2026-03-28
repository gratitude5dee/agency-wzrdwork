/**
 * useAgentComposioTools — resolves the effective Composio tools available to an
 * agent, combining the company-scoped Composio integration config with the
 * agent's per-agent composioTools selection in adapter_config.
 *
 * Resolution:
 *   1. Company must have Composio enabled with a consumer key.
 *   2. Agent's adapter_config.composioTools selects which tools the agent uses.
 *   3. If the agent has no explicit selection, falls back to the company's
 *      selected_tools (from the integrations row).
 *   4. Returns the effective list plus connection state.
 */

import { useMemo } from "react";
import { useComposioConfig } from "@/hooks/useComposioConfig";

interface AgentAdapterConfig {
  composioTools?: string[];
  [key: string]: unknown;
}

export interface AgentComposioToolsResult {
  /** Whether Composio is enabled and configured at the company level */
  composioAvailable: boolean;
  /** The consumer key (for MCP calls) */
  consumerKey: string;
  /** MCP URL for tool calls */
  mcpUrl: string;
  /** The effective tool names available to this agent */
  effectiveTools: string[];
  /** Whether the agent has an explicit tool selection */
  hasAgentOverride: boolean;
  /** Loading state */
  isLoading: boolean;
}

export function useAgentComposioTools(
  adapterConfig: AgentAdapterConfig | null,
): AgentComposioToolsResult {
  const { config: composioConfig, isLoading } = useComposioConfig();

  return useMemo(() => {
    const composioAvailable =
      composioConfig.enabled && !!composioConfig.consumerKey;

    if (!composioAvailable) {
      return {
        composioAvailable: false,
        consumerKey: "",
        mcpUrl: composioConfig.mcpUrl,
        effectiveTools: [],
        hasAgentOverride: false,
        isLoading,
      };
    }

    const agentTools = adapterConfig?.composioTools;
    const hasAgentOverride = Array.isArray(agentTools) && agentTools.length > 0;

    const effectiveTools = hasAgentOverride
      ? agentTools!
      : composioConfig.selectedTools;

    return {
      composioAvailable: true,
      consumerKey: composioConfig.consumerKey,
      mcpUrl: composioConfig.mcpUrl,
      effectiveTools,
      hasAgentOverride,
      isLoading,
    };
  }, [composioConfig, adapterConfig, isLoading]);
}
