import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plug,
  Shield,
  Database,
  Brain,
  Users,
  ArrowLeftRight,
  Cpu,
  Droplets,
  CreditCard,
  Coins,
  Palette,
  AtSign,
  Fingerprint,
  Lock,
  Wallet,
  Image,
  BarChart3,
  Settings2,
  Wrench,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { ComposioToolDiscovery } from "@/components/ComposioToolDiscovery";
import type { Database as DB, Json } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type IntegrationRow = DB["public"]["Tables"]["integrations"]["Row"];

interface IntegrationDef {
  key: string;
  name: string;
  category: string;
  icon: React.ElementType;
  /** If true, show a chain selector in the config dialog */
  hasChainSelector?: boolean;
  /** Extra custom fields shown in the config dialog */
  extraFields?: { key: string; label: string; placeholder?: string }[];
}

// ---------------------------------------------------------------------------
// Integration definitions (static – 16 integrations)
// ---------------------------------------------------------------------------

const INTEGRATIONS: IntegrationDef[] = [
  { key: "thirdweb", name: "thirdweb", category: "Auth", icon: Shield },
  { key: "supabase", name: "supabase", category: "Database", icon: Database },
  { key: "venice", name: "venice", category: "Private AI", icon: Brain },
  { key: "openserv", name: "openserv", category: "Agent Coordination", icon: Users },
  {
    key: "uniswap",
    name: "uniswap",
    category: "Token Swaps",
    icon: ArrowLeftRight,
    hasChainSelector: true,
  },
  { key: "bankr", name: "bankr", category: "LLM Gateway", icon: Cpu },
  {
    key: "lido",
    name: "lido",
    category: "stETH Treasury",
    icon: Droplets,
    hasChainSelector: true,
  },
  { key: "agentcash", name: "agentcash", category: "x402 Payments", icon: CreditCard },
  {
    key: "celo",
    name: "celo",
    category: "Stablecoin L2",
    icon: Coins,
    hasChainSelector: true,
  },
  { key: "superrare", name: "superrare", category: "Rare Protocol", icon: Palette },
  { key: "ens", name: "ens", category: "Identity + Names", icon: AtSign },
  { key: "self", name: "self", category: "ZK Identity", icon: Fingerprint },
  { key: "arkhai", name: "arkhai", category: "Escrow", icon: Lock },
  {
    key: "metamask",
    name: "metamask",
    category: "Delegations",
    icon: Wallet,
    hasChainSelector: true,
  },
  { key: "fal", name: "fal", category: "Media Generation", icon: Image },
  { key: "bond_credit", name: "bond_credit", category: "Credit Scores", icon: BarChart3 },
  {
    key: "composio",
    name: "Composio",
    category: "MCP Tools",
    icon: Wrench,
    extraFields: [
      { key: "consumer_key", label: "Consumer Key (ck_…)", placeholder: "ck_your_key_here" },
      { key: "mcp_url", label: "MCP Server URL", placeholder: "https://connect.composio.dev/mcp" },
    ],
  },
];

const CHAIN_OPTIONS = [
  { value: "1", label: "Ethereum Mainnet" },
  { value: "42161", label: "Arbitrum One" },
  { value: "42220", label: "Celo" },
  { value: "10", label: "Optimism" },
  { value: "8453", label: "Base" },
];

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type IntegrationStatus = "connected" | "disconnected" | "error";

function deriveStatus(row?: IntegrationRow): IntegrationStatus {
  if (!row) return "disconnected";
  if (!row.enabled) return "disconnected";
  const config = row.config as Record<string, unknown> | null;
  if (config && typeof config === "object") {
    // Standard api_key or Composio consumer_key both count as valid credentials
    if (config.api_key || config.consumer_key) return "connected";
  }
  return "disconnected";
}

const STATUS_DOT: Record<IntegrationStatus, string> = {
  connected: "bg-emerald-500",
  disconnected: "bg-zinc-500",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IntegrationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Resolve the active company from wallet + onboarding context
  const { company: activeCompany } = useActiveCompany();
  const company = activeCompany
    ? { id: activeCompany.id, wallet_address: activeCompany.wallet_address }
    : null;

  const companyId = company?.id ?? null;

  // Fetch existing integrations from Supabase
  const { data: integrationRows = [] } = useQuery<IntegrationRow[]>({
    queryKey: ["integrations", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integrations")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as IntegrationRow[];
    },
  });

  // Map integration_key → row for quick lookup
  const rowMap = new Map(integrationRows.map((r) => [r.integration_key, r]));

  // ---- Toggle mutation ----
  const toggleMutation = useMutation({
    mutationFn: async ({
      integrationKey,
      enabled,
    }: {
      integrationKey: string;
      enabled: boolean;
    }) => {
      if (!companyId) throw new Error("No company found");

      const existing = rowMap.get(integrationKey);
      if (existing) {
        const { error } = await supabase
          .from("integrations")
          .update({ enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Create new row
        const def = INTEGRATIONS.find((d) => d.key === integrationKey)!;
        const { error } = await supabase.from("integrations").insert({
          company_id: companyId,
          integration_key: integrationKey,
          name: def.name,
          enabled,
          config: {},
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
    },
    onError: (err: Error) => {
      toast({ title: "Toggle failed", description: err.message, variant: "destructive" });
    },
  });

  // ---- Configure dialog state ----
  const [configDef, setConfigDef] = useState<IntegrationDef | null>(null);
  const [configApiKey, setConfigApiKey] = useState("");
  const [configChain, setConfigChain] = useState("");
  const [configExtra, setConfigExtra] = useState<Record<string, string>>({});
  const [composioSelectedTools, setComposioSelectedTools] = useState<string[]>([]);

  const openConfigDialog = useCallback(
    (def: IntegrationDef) => {
      const existing = rowMap.get(def.key);
      const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;
      setConfigDef(def);
      setConfigApiKey(String(existingConfig.api_key ?? ""));
      setConfigChain(String(existingConfig.chain_id ?? ""));
      const extra: Record<string, string> = {};
      for (const f of def.extraFields ?? []) {
        extra[f.key] = String(existingConfig[f.key] ?? "");
      }
      setConfigExtra(extra);

      // Composio: restore selected tools
      if (def.key === "composio" && Array.isArray(existingConfig.selected_tools)) {
        setComposioSelectedTools(
          (existingConfig.selected_tools as string[]).filter((t) => typeof t === "string"),
        );
      } else {
        setComposioSelectedTools([]);
      }
    },
    [rowMap],
  );

  const closeConfigDialog = useCallback(() => {
    setConfigDef(null);
    setConfigApiKey("");
    setConfigChain("");
    setConfigExtra({});
    setComposioSelectedTools([]);
  }, []);

  // ---- Save config mutation ----
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !configDef) throw new Error("No company or integration selected");

      // For Composio, the credential is consumer_key (from extra fields), not api_key.
      // Preserve existing config fields (e.g. selected_tools) that aren't in the form.
      const existing = rowMap.get(configDef.key);
      const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;

      const config: Record<string, unknown> = configDef.key === "composio"
        ? { ...existingConfig }
        : { api_key: configApiKey };

      if (configDef.key !== "composio" && configDef.hasChainSelector && configChain) {
        config.chain_id = configChain;
      }
      for (const [k, v] of Object.entries(configExtra)) {
        if (v) config[k] = v;
      }

      // Composio: persist selected tools
      if (configDef.key === "composio") {
        config.selected_tools = composioSelectedTools;
      }

      if (existing) {
        const { error } = await supabase
          .from("integrations")
          .update({ config: config as unknown as Json, enabled: true })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          company_id: companyId,
          integration_key: configDef.key,
          name: configDef.name,
          enabled: true,
          config: config as unknown as Json,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", companyId] });
      queryClient.invalidateQueries({ queryKey: ["composio-config", companyId] });
      toast({ title: "Configuration saved" });
      closeConfigDialog();
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Plug className="h-6 w-6 text-zinc-400" />
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">Integrations</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Connect external services and APIs to your agent network.
          </p>
        </div>
      </div>

      {/* Integration cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {INTEGRATIONS.map((def) => {
          const row = rowMap.get(def.key);
          const status = deriveStatus(row);
          const enabled = row?.enabled ?? false;
          const Icon = def.icon;

          return (
            <Card
              key={def.key}
              className="border-white/10 bg-[#0d1118] transition-colors hover:border-blue-500/20"
            >
              <CardContent className="flex flex-col gap-4 p-4">
                {/* Top row: icon + name + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black">
                      <Icon className="h-5 w-5 text-zinc-300" />
                    </div>
                    <div>
                      <p className="font-bold text-zinc-100">{def.name}</p>
                      <p className="text-xs text-zinc-500">{def.category}</p>
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({
                        integrationKey: def.key,
                        enabled: checked,
                      })
                    }
                  />
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                  <span className="text-xs text-zinc-400">{STATUS_LABEL[status]}</span>
                </div>

                {/* Configure button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-white/10 text-zinc-300 hover:border-blue-500/30"
                  onClick={() => openConfigDialog(def)}
                >
                  <Settings2 className="mr-2 h-3.5 w-3.5" />
                  Configure
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Configure dialog */}
      <Dialog open={!!configDef} onOpenChange={(open) => !open && closeConfigDialog()}>
        <DialogContent className="border-white/10 bg-[#0d1118] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Configure {configDef?.name}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Enter credentials and settings for the {configDef?.name} integration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* API key — hidden for Composio which uses consumer_key via extra fields */}
            {configDef?.key !== "composio" && (
              <div className="space-y-2">
                <Label htmlFor="config-api-key" className="text-zinc-300">
                  API Key
                </Label>
                <Input
                  id="config-api-key"
                  type="password"
                  placeholder="Enter API key…"
                  value={configApiKey}
                  onChange={(e) => setConfigApiKey(e.target.value)}
                  className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            )}

            {/* Chain selector (conditional) */}
            {configDef?.hasChainSelector && (
              <div className="space-y-2">
                <Label htmlFor="config-chain" className="text-zinc-300">
                  Chain
                </Label>
                <Select value={configChain} onValueChange={setConfigChain}>
                  <SelectTrigger
                    id="config-chain"
                    className="border-white/10 bg-black text-zinc-100"
                  >
                    <SelectValue placeholder="Select chain…" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0d1118]">
                    {CHAIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Extra fields (if defined) */}
            {configDef?.extraFields?.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`config-${field.key}`} className="text-zinc-300">
                  {field.label}
                </Label>
                <Input
                  id={`config-${field.key}`}
                  type={field.key === "consumer_key" ? "password" : "text"}
                  placeholder={field.placeholder ?? ""}
                  value={configExtra[field.key] ?? ""}
                  onChange={(e) =>
                    setConfigExtra((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="border-white/10 bg-black text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            ))}

            {/* Composio tool discovery */}
            {configDef?.key === "composio" && (
              <ComposioToolDiscovery
                consumerKey={configExtra.consumer_key ?? ""}
                mcpUrl={configExtra.mcp_url || "https://connect.composio.dev/mcp"}
                selectedTools={composioSelectedTools}
                onSelectionChange={setComposioSelectedTools}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeConfigDialog} className="text-zinc-400">
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
