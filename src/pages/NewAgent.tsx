import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { adapterRegistry } from "@/adapters/registry";
import { createAgentIdentity } from "@/lib/erc8004/identity";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import type { CreateConfigValues } from "@/adapters/types";
import type { Json } from "@/integrations/supabase/types";

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
  url: "",
  bootstrapPrompt: "",
  maxTurnsPerRun: 25,
  heartbeatEnabled: false,
  intervalSec: 30,
};

export function NewAgentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [adapterType, setAdapterType] = useState("");
  const [configValues, setConfigValues] = useState<CreateConfigValues>(DEFAULT_CONFIG_VALUES);

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

  // Get adapter types from the registry
  const adapterTypes = useMemo(
    () => Array.from(adapterRegistry.entries()).map(([type, mod]) => ({ type, label: mod.label })),
    [],
  );

  // Get the selected adapter's ConfigFields component
  const selectedAdapter = useMemo(
    () => (adapterType ? adapterRegistry.get(adapterType) : null),
    [adapterType],
  );

  const handleConfigChange = useCallback(
    (patch: Partial<CreateConfigValues>) => {
      setConfigValues((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  // Get company_id and wallet_address from active-company resolution
  const { company: activeCompany } = useActiveCompany();
  const company = activeCompany
    ? { id: activeCompany.id, wallet_address: activeCompany.wallet_address }
    : null;

  const createMutation = useMutation({
    mutationFn: async () => {
      const companyId = company?.id;
      if (!companyId) throw new Error("No company found. Please complete onboarding first.");

      // Build adapter config from the selected adapter
      const adapterConfig = selectedAdapter
        ? selectedAdapter.buildAdapterConfig({ ...configValues, adapterType })
        : {};

      const { data, error } = await supabase
        .from("agents")
        .insert({
          company_id: companyId,
          name,
          title: title || null,
          role,
          reports_to: reportsTo && reportsTo !== "none" ? reportsTo : null,
          adapter_type: adapterType,
          adapter_config: adapterConfig as unknown as Json,
          status: "idle",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: async (data) => {
      // Auto-create ERC-8004 identity for the new agent
      const companyId = company?.id;
      const walletAddress = company?.wallet_address;
      if (companyId) {
        try {
          await createAgentIdentity(data.id, companyId, walletAddress ?? "0x0");
        } catch {
          // Non-blocking: identity can be created later from the detail page
          console.warn("ERC-8004 identity auto-creation failed; can be retried from agent detail.");
        }
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
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
