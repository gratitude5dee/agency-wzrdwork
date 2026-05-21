import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Loader2, Zap, Plug } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { adapterRegistry } from "@/adapters/registry";
import { adapterExecutionLabel, isExecutableAdapter } from "@/adapters/execution-support";
import { createAgentIdentity, isPlaceholderWallet } from "@/lib/erc8004/identity";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useCompanySkills } from "@/hooks/useSkills";
import { getClientWalletAddress } from "@/lib/server-api/actor";
import { createAgentRecord } from "@/lib/server-api/agents";
import type { CreateConfigValues } from "@/adapters/types";
import type { Json } from "@/integrations/supabase/types";
import type { Database as DB } from "@/integrations/supabase/types";

type IntegrationRow = DB["public"]["Tables"]["integrations"]["Row"];

const AGENT_ROLES = [
  { value: "ceo", label: "CEO" },
  { value: "cto", label: "CTO" },
  { value: "coo", label: "COO" },
  { value: "manager", label: "Manager" },
  { value: "engineer", label: "Engineer" },
  { value: "founding_engineer", label: "Founding Engineer" },
  { value: "analyst", label: "Analyst" },
  { value: "designer", label: "Designer" },
  { value: "researcher", label: "Researcher" },
  { value: "ops", label: "Operations" },
  { value: "support", label: "Support" },
  { value: "custom", label: "Custom" },
];

interface AgentPickerRow {
  id: string;
  name: string;
  role: string;
}

const DEFAULT_CONFIG_VALUES: CreateConfigValues = {
  adapterType: "",
  cwd: "",
  promptTemplate: "",
  model: "",
  thinkingEffort: "medium",
  chrome: false,
  dangerouslySkipPermissions: false,
  search: false,
  dangerouslyBypassSandbox: false,
  command: "",
  args: "",
  extraArgs: "",
  envVars: "",
  envBindings: {},
  adapterSchemaValues: {},
  url: "",
  bootstrapPrompt: "",
  maxTurnsPerRun: 25,
  heartbeatEnabled: false,
  intervalSec: 30,
};

const LOCAL_WORKDIR_ADAPTERS = new Set([
  "process",
  "claude_local",
  "codex_local",
  "cursor",
  "gemini_local",
  "grok_local",
  "opencode_local",
  "pi_local",
  "acpx_local",
]);

export function NewAgentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const account = useActiveAccount();
  const walletAddress = getClientWalletAddress(account?.address);

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [adapterType, setAdapterType] = useState("");
  const [configValues, setConfigValues] = useState<CreateConfigValues>(DEFAULT_CONFIG_VALUES);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [agentIntegrations, setAgentIntegrations] = useState<Map<string, boolean>>(new Map());

  // Get company_id and wallet_address from active-company resolution
  const { company: activeCompany } = useActiveCompany();
  const company = activeCompany
    ? { id: activeCompany.id, wallet_address: activeCompany.wallet_address }
    : null;

  // Fetch agents for the reports_to picker
  const { data: existingAgents = [] } = useQuery<AgentPickerRow[]>({
    queryKey: ["agents-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, role")
        .order("name", { ascending: true });

      if (error) return [];
      return (data ?? []) as AgentPickerRow[];
    },
  });

  // Fetch company skills
  const { data: companySkills = [] } = useCompanySkills();

  // Fetch company integrations
  const { data: companyIntegrations = [] } = useQuery<IntegrationRow[]>({
    queryKey: ["integrations-for-newagent", activeCompany?.id],
    enabled: !!activeCompany?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", activeCompany!.id)
        .order("created_at", { ascending: true });

      if (error) return [];
      return (data ?? []) as IntegrationRow[];
    },
  });

  // Get adapter types from the registry
  const adapterTypes = useMemo(
    () =>
      Array.from(adapterRegistry.entries()).map(([type, mod]) => ({
        type,
        label: mod.label,
        executable: isExecutableAdapter(type),
      })),
    [],
  );

  // Get the selected adapter's ConfigFields component
  const selectedAdapter = useMemo(
    () => (adapterType ? adapterRegistry.get(adapterType) : null),
    [adapterType],
  );
  const selectedAdapterExecutable = isExecutableAdapter(adapterType);

  const handleConfigChange = useCallback(
    (patch: Partial<CreateConfigValues>) => {
      setConfigValues((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const companyId = company?.id;
      if (!companyId) throw new Error("No company found. Please complete onboarding first.");

      // Build adapter config from the selected adapter
      const adapterConfig = selectedAdapter
        ? selectedAdapter.buildAdapterConfig({ ...configValues, adapterType })
        : {};

      return await createAgentRecord({
        companyId,
        walletAddress,
          name,
          title: title || null,
          role,
        reportsTo: reportsTo && reportsTo !== "none" ? reportsTo : null,
        adapterType,
        adapterConfig: adapterConfig as unknown as Json as Record<string, unknown>,
        selectedSkillIds: Array.from(selectedSkillIds),
        integrationIds: Array.from(agentIntegrations.entries())
          .filter(([_, enabled]) => enabled)
          .map(([integrationId]) => integrationId),
      });
    },
    onSuccess: async (data) => {
      // Auto-create ERC-8004 identity for the new agent.
      // Requires a real (non-placeholder) operator wallet from the active company.
      const companyId = company?.id;
      const walletAddress = company?.wallet_address;
      if (companyId && !isPlaceholderWallet(walletAddress)) {
        try {
          await createAgentIdentity(data.id, companyId, walletAddress!);
        } catch (err) {
          // Non-blocking: identity can be created later from the detail page
          console.warn(
            "ERC-8004 identity auto-creation failed; can be retried from agent detail.",
            err instanceof Error ? err.message : err,
          );
        }
      } else {
        console.warn(
          "ERC-8004 identity skipped: no active company wallet. Connect a wallet and retry from agent detail.",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["agents-list"] });
      queryClient.invalidateQueries({ queryKey: ["agents-picker"] });
      queryClient.invalidateQueries({ queryKey: ["agency-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-agents"] });
      toast.success("Agent created successfully");
      navigate(`/agents/${data.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create agent");
    },
  });

  const canSubmit = name.trim() && role && adapterType && !createMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <Link to="/agents">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">Create New Agent</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure and deploy a new AI agent.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          {/* Basic Info */}
          <Card className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-zinc-100">
                <Bot className="h-4 w-4" />
                Basic Information
              </CardTitle>
              <CardDescription className="text-zinc-500">
                Name, role, and reporting structure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name (required) */}
              <div className="space-y-2">
                <Label htmlFor="agent-name" className="text-zinc-300">
                  Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="agent-name"
                  required
                  placeholder="e.g. Lead Engineer"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
                />
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="agent-title" className="text-zinc-300">
                  Title
                </Label>
                <Input
                  id="agent-title"
                  placeholder="e.g. Senior Software Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-white/10 bg-[#080c14] text-zinc-200 placeholder:text-zinc-600"
                />
              </div>

              {/* Role (dropdown) */}
              <div className="space-y-2">
                <Label className="text-zinc-300">
                  Role <span className="text-red-400">*</span>
                </Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="border-white/10 bg-[#080c14] text-zinc-200">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENT_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reports To (agent picker) */}
              <div className="space-y-2">
                <Label className="text-zinc-300">Reports To</Label>
                <Select value={reportsTo} onValueChange={setReportsTo}>
                  <SelectTrigger className="border-white/10 bg-[#080c14] text-zinc-200">
                    <SelectValue placeholder="None (root agent)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (root agent)</SelectItem>
                    {existingAgents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Adapter Selection */}
          <Card className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="text-zinc-100">Adapter Type</CardTitle>
              <CardDescription className="text-zinc-500">
                Choose the harness adapter for this agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-300">
                  Adapter Type <span className="text-red-400">*</span>
                </Label>
                <Select value={adapterType} onValueChange={setAdapterType}>
                  <SelectTrigger className="border-white/10 bg-[#080c14] text-zinc-200">
                    <SelectValue placeholder="Select an adapter type" />
                  </SelectTrigger>
                  <SelectContent>
                    {adapterTypes.map((a) => (
                      <SelectItem key={a.type} value={a.type}>
                        {a.label} {!a.executable ? "(config only)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {adapterType && (
                <Badge
                  variant="outline"
                  className={`border-white/10 ${
                    selectedAdapterExecutable
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "bg-zinc-500/10 text-zinc-300"
                  }`}
                >
                  {adapterExecutionLabel(adapterType)}
                </Badge>
              )}

              {/* Show ConfigFields from selected adapter */}
              {selectedAdapter && (
                <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-[#080c14] p-4">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                    {selectedAdapter.label} Configuration
                  </p>
                  <selectedAdapter.ConfigFields
                    mode="create"
                    isCreate={true}
                    adapterType={adapterType}
                    values={configValues}
                    set={handleConfigChange}
                    config={{}}
                    eff={() => "" as never}
                    mark={() => {}}
                    models={[]}
                  />

                  {LOCAL_WORKDIR_ADAPTERS.has(adapterType) && (
                    <div className="space-y-2">
                      <Label htmlFor="agent-cwd" className="text-zinc-300">
                        Working Directory
                      </Label>
                      <Input
                        id="agent-cwd"
                        value={configValues.cwd}
                        onChange={(e) => handleConfigChange({ cwd: e.target.value })}
                        placeholder="/absolute/path/to/workspace"
                        className="border-white/10 bg-black/40 font-mono text-sm text-zinc-200"
                      />
                      <p className="text-xs text-zinc-500">
                        Required for local execution adapters in the control-plane worker.
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-zinc-300">Heartbeat Schedule</Label>
                        <p className="text-xs text-zinc-500">
                          Timer-based execution using the M1 control-plane worker.
                        </p>
                      </div>
                      <Switch
                        checked={configValues.heartbeatEnabled}
                        onCheckedChange={(checked) =>
                          handleConfigChange({ heartbeatEnabled: checked })
                        }
                        disabled={!selectedAdapterExecutable}
                        aria-label="Enable heartbeat schedule"
                      />
                    </div>

                    <div className="mt-4 space-y-2">
                      <Label htmlFor="heartbeat-interval" className="text-zinc-300">
                        Interval Seconds
                      </Label>
                      <Input
                        id="heartbeat-interval"
                        type="number"
                        min={1}
                        value={configValues.intervalSec}
                        onChange={(e) =>
                          handleConfigChange({
                            intervalSec: Math.max(1, Number.parseInt(e.target.value || "0", 10) || 1),
                          })
                        }
                        disabled={!selectedAdapterExecutable || !configValues.heartbeatEnabled}
                        className="border-white/10 bg-black/40 text-zinc-200"
                      />
                    </div>

                    {!selectedAdapterExecutable && (
                      <p className="mt-3 text-xs text-zinc-500">
                        This adapter can still be configured, but the M1 control-plane will not execute it.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Skills Selection */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Zap className="h-4 w-4" />
              Skills
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Select skills to assign to this agent. Skills define what the agent can do.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {companySkills.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No skills configured yet. Visit the{" "}
                <a href="/skills" className="text-blue-400 underline">
                  Skills page
                </a>{" "}
                to create or import skills.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {companySkills.filter(s => s.enabled).map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => {
                      const newSelected = new Set(selectedSkillIds);
                      if (newSelected.has(skill.id)) {
                        newSelected.delete(skill.id);
                      } else {
                        newSelected.add(skill.id);
                      }
                      setSelectedSkillIds(newSelected);
                    }}
                    className={`rounded-full px-3 py-1.5 text-sm border transition-colors ${
                      selectedSkillIds.has(skill.id)
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                        : 'border-white/10 bg-[#080c14] text-zinc-400 hover:border-white/20'
                    }`}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integrations Configuration */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Plug className="h-4 w-4" />
              Integrations
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Configure which integrations this agent has access to. Override company defaults per-agent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {companyIntegrations.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No integrations configured yet. Visit the{" "}
                <a href="/integrations" className="text-blue-400 underline">
                  Integrations page
                </a>{" "}
                to set up integrations.
              </p>
            ) : (
              <div className="space-y-3">
                {companyIntegrations.map((integration) => {
                  const isEnabled = agentIntegrations.get(integration.id) ?? integration.enabled;
                  return (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-[#080c14] p-3"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-zinc-200">{integration.name}</p>
                        <p className="text-xs text-zinc-500">
                          {integration.integration_key}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`border-white/10 text-xs ${
                            integration.enabled
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-zinc-500/10 text-zinc-400'
                          }`}
                        >
                          {integration.enabled ? 'Company Default' : 'Disabled'}
                        </Badge>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(checked) => {
                            const newIntegrations = new Map(agentIntegrations);
                            if (checked) {
                              newIntegrations.set(integration.id, true);
                            } else {
                              newIntegrations.delete(integration.id);
                            }
                            setAgentIntegrations(newIntegrations);
                          }}
                          aria-label={`Toggle ${integration.name} access`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="outline" className="border-white/10">
            <Link to="/agents">Cancel</Link>
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="gap-2"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Agent"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
