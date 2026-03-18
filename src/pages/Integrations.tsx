import { useState, useCallback, useMemo } from "react";
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

import { Badge } from "@/components/ui/badge";
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
import { PageLoadingState, PageErrorState } from "@/components/PageStateIndicators";
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
  /** "core" integrations are hackathon critical-path; "stretch" are nice-to-have */
  tier: "core" | "stretch";
  /** If true, show a chain selector in the config dialog */
  hasChainSelector?: boolean;
  /** Extra custom fields shown in the config dialog */
  extraFields?: { key: string; label: string; placeholder?: string }[];
}

// ---------------------------------------------------------------------------
// Integration definitions (static – 16 integrations)
// ---------------------------------------------------------------------------

const INTEGRATIONS: IntegrationDef[] = [
  { key: "thirdweb", name: "thirdweb", category: "Auth", icon: Shield, tier: "core" },
  { key: "supabase", name: "supabase", category: "Database", icon: Database, tier: "core" },
  { key: "venice", name: "venice", category: "Private AI", icon: Brain, tier: "core" },
  { key: "openserv", name: "openserv", category: "Agent Coordination", icon: Users, tier: "core" },
  {
    key: "uniswap",
    name: "uniswap",
    category: "Token Swaps",
    icon: ArrowLeftRight,
    tier: "core",
    hasChainSelector: true,
  },
  { key: "bankr", name: "bankr", category: "LLM Gateway", icon: Cpu, tier: "core" },
  {
    key: "lido",
    name: "lido",
    category: "stETH Treasury",
    icon: Droplets,
    tier: "core",
    hasChainSelector: true,
  },
  { key: "agentcash", name: "agentcash", category: "x402 Payments", icon: CreditCard, tier: "core" },
  {
    key: "celo",
    name: "celo",
    category: "Stablecoin L2",
    icon: Coins,
    tier: "core",
    hasChainSelector: true,
  },
  { key: "superrare", name: "superrare", category: "Rare Protocol", icon: Palette, tier: "stretch" },
  { key: "ens", name: "ens", category: "Identity + Names", icon: AtSign, tier: "stretch" },
  { key: "self", name: "self", category: "ZK Identity", icon: Fingerprint, tier: "stretch" },
  { key: "arkhai", name: "arkhai", category: "Escrow", icon: Lock, tier: "stretch" },
  {
    key: "metamask",
    name: "metamask",
    category: "Delegations",
    icon: Wallet,
    tier: "core",
    hasChainSelector: true,
  },
  { key: "fal", name: "fal", category: "Media Generation", icon: Image, tier: "stretch" },
  { key: "bond_credit", name: "bond_credit", category: "Credit Scores", icon: BarChart3, tier: "stretch" },
  {
    key: "composio",
    name: "Composio",
    category: "MCP Tools",
    icon: Wrench,
    tier: "core",
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

/**
 * Derive the visible status for an integration card.
 *
 * An integration is "connected" only when it is enabled AND has valid
 * credentials. If it is enabled but credentials are missing or blank,
 * it shows "error" (misconfigured) so invalid config never silently
 * appears as Connected (VAL-INTEGRATIONS-003).
 */
function deriveStatus(row?: IntegrationRow, def?: IntegrationDef): IntegrationStatus {
  if (!row) return "disconnected";
  if (!row.enabled) return "disconnected";
  const config = row.config as Record<string, unknown> | null;
  if (!config || typeof config !== "object") return "error";

  // Composio requires consumer_key
  if (def?.key === "composio") {
    const ck = config.consumer_key;
    if (typeof ck === "string" && ck.trim().length > 0) return "connected";
    return "error";
  }

  // All other integrations require api_key
  const apiKey = config.api_key;
  if (typeof apiKey === "string" && apiKey.trim().length > 0) return "connected";

  // Enabled but no valid credential → misconfigured
  return "error";
}

const STATUS_DOT: Record<IntegrationStatus, string> = {
  connected: "bg-emerald-500",
  disconnected: "bg-zinc-500",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Misconfigured",
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
  const {
    data: integrationRows = [],
    isLoading: integrationsLoading,
    isError: integrationsError,
    error: integrationsQueryError,
    refetch: refetchIntegrations,
  } = useQuery<IntegrationRow[]>({
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

  // Map integration_key → row for quick lookup (memoized to stabilize callbacks)
  const rowMap = useMemo(
    () => new Map(integrationRows.map((r) => [r.integration_key, r])),
    [integrationRows],
  );

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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const openConfigDialog = useCallback(
    (def: IntegrationDef) => {
      const existing = rowMap.get(def.key);
      const existingConfig = (existing?.config ?? {}) as Record<string, unknown>;
      setConfigDef(def);
      setConfigApiKey(String(existingConfig.api_key ?? ""));
      setConfigChain(String(existingConfig.chain_id ?? ""));
      setValidationErrors([]);
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
    setValidationErrors([]);
  }, []);

  // ---- Validate config before save ----
  const validateConfig = useCallback((): string[] => {
    if (!configDef) return ["No integration selected"];
    const errors: string[] = [];
    if (configDef.key === "composio") {
      // Composio: require consumer_key
      if (!configExtra.consumer_key?.trim()) {
        errors.push("Consumer Key is required");
      }
    } else {
      // All others: require api_key
      if (!configApiKey.trim()) {
        errors.push("API Key is required");
      }
    }
    return errors;
  }, [configDef, configApiKey, configExtra]);

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

  if (integrationsLoading && companyId) {
    return <PageLoadingState label="Loading integrations…" rows={4} />;
  }

  if (integrationsError) {
    return (
      <PageErrorState
        message={
          integrationsQueryError instanceof Error
            ? integrationsQueryError.message
            : "Failed to load integrations."
        }
        onRetry={() => refetchIntegrations()}
      />
    );
  }

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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {INTEGRATIONS.map((def) => {
          const row = rowMap.get(def.key);
          const status = deriveStatus(row, def);
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
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="font-bold text-zinc-100">{def.name}</p>
                        <p className="text-xs text-zinc-500">{def.category}</p>
                      </div>
                      <Badge
                        variant={def.tier === "core" ? "default" : "secondary"}
                        className={
                          def.tier === "core"
                            ? "bg-blue-600/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0"
                            : "bg-zinc-700/30 text-zinc-500 border-zinc-600/30 text-[10px] px-1.5 py-0"
                        }
                      >
                        {def.tier === "core" ? "Core" : "Stretch"}
                      </Badge>
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
                {/* Validation feedback for misconfigured integrations */}
                {status === "error" && (
                  <p className="text-xs text-red-400">
                    Missing credentials — open Configure to fix.
                  </p>
                )}

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

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3" role="alert">
              {validationErrors.map((err) => (
                <p key={err} className="text-sm text-red-400">
                  {err}
                </p>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={closeConfigDialog} className="text-zinc-400">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const errors = validateConfig();
                if (errors.length > 0) {
                  setValidationErrors(errors);
                  return;
                }
                setValidationErrors([]);
                saveMutation.mutate();
              }}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving…" : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
