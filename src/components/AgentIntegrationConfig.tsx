/**
 * AgentIntegrationConfig — per-agent integration management
 *
 * Allows enabling/disabling integrations for specific agents,
 * overriding company-level defaults.
 */

import { useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { toast } from "sonner";
import type { Database as DB } from "@/integrations/supabase/types";

type IntegrationRow = DB["public"]["Tables"]["integrations"]["Row"];

// Workaround: agent_integrations table not yet in generated types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface AgentIntegrationRow {
  id: string;
  agent_id: string;
  integration_id: string;
  company_id: string;
  enabled: boolean;
  created_at: string;
}

interface AgentIntegrationConfigProps {
  agentId: string;
}

export function AgentIntegrationConfig({ agentId }: AgentIntegrationConfigProps) {
  const { companyId } = useActiveCompany();
  const queryClient = useQueryClient();

  // Fetch company integrations
  const { data: companyIntegrations = [], isLoading: integrationsLoading } = useQuery<IntegrationRow[]>({
    queryKey: ["agent-integrations-company", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: true });

      if (error) return [];
      return (data ?? []) as IntegrationRow[];
    },
  });

  // Fetch agent-specific integration overrides
  const { data: agentIntegrationOverrides = [], isLoading: overridesLoading } = useQuery<
    AgentIntegrationRow[]
  >({
    queryKey: ["agent-integrations-overrides", agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await db
        .from("agent_integrations")
        .select("*")
        .eq("agent_id", agentId);

      if (error) {
        // Table may not exist yet - handle gracefully
        if (error.message?.includes("does not exist")) {
          return [];
        }
        console.warn("Failed to fetch agent integrations:", error);
        return [];
      }
      return (data ?? []) as AgentIntegrationRow[];
    },
  });

  // Map integration IDs to agent-level enabled status
  const agentIntegrationMap = useMemo(
    () => new Map(agentIntegrationOverrides.map((ai) => [ai.integration_id, ai.enabled])),
    [agentIntegrationOverrides],
  );

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({
      integrationId,
      enabled,
    }: {
      integrationId: string;
      enabled: boolean;
    }) => {
      if (!companyId) throw new Error("No company found");

      const existing = agentIntegrationOverrides.find((ai) => ai.integration_id === integrationId);

      if (existing) {
        // Update existing override
        const { error } = await db
          .from("agent_integrations")
          .update({ enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Create new override
        const { error } = await db.from("agent_integrations").insert({
          agent_id: agentId,
          integration_id: integrationId,
          company_id: companyId,
          enabled,
        });
        if (error) {
          // If table doesn't exist, provide helpful message
          if (error.message?.includes("does not exist")) {
            throw new Error(
              "Agent integrations table not yet created. This feature will be available once migrations are applied.",
            );
          }
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-integrations-overrides", agentId] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update integration");
    },
  });

  const handleToggle = useCallback(
    (integrationId: string) => {
      const currentEnabled = agentIntegrationMap.get(integrationId);
      const newEnabled = !currentEnabled;
      toggleMutation.mutate({ integrationId, enabled: newEnabled });
    },
    [agentIntegrationMap, toggleMutation],
  );

  if (integrationsLoading || overridesLoading) {
    return (
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-zinc-100">
            <Plug className="h-4 w-4" />
            Agent Integrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded bg-zinc-800" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-[#0d1118]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Plug className="h-4 w-4" />
          Agent Integrations
        </CardTitle>
        <CardDescription className="text-zinc-500">
          Configure which integrations this agent can access. Overrides company defaults.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {companyIntegrations.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No integrations configured. Visit the{" "}
            <a href="/integrations" className="text-blue-400 underline">
              Integrations page
            </a>{" "}
            to set up integrations.
          </p>
        ) : (
          <div className="space-y-3">
            {companyIntegrations.map((integration) => {
              const agentEnabled = agentIntegrationMap.get(integration.id);
              const showsCustom = agentEnabled !== undefined;

              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-[#080c14] p-3"
                >
                  <div className="flex-1">
                    <p className="font-medium text-zinc-200">{integration.name}</p>
                    <p className="text-xs text-zinc-500">{integration.integration_key}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          integration.enabled ? "bg-emerald-500" : "bg-zinc-500"
                        }`}
                        title={integration.enabled ? "Company: Enabled" : "Company: Disabled"}
                      />
                      <Badge
                        variant="outline"
                        className={`border-white/10 text-xs ${
                          showsCustom
                            ? "bg-orange-500/10 text-orange-400"
                            : "bg-zinc-500/10 text-zinc-400"
                        }`}
                      >
                        {showsCustom ? "Custom" : "Company Default"}
                      </Badge>
                    </div>
                    <Switch
                      checked={agentEnabled ?? integration.enabled}
                      onCheckedChange={() => handleToggle(integration.id)}
                      disabled={toggleMutation.isPending}
                      aria-label={`Toggle ${integration.name} access for this agent`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
