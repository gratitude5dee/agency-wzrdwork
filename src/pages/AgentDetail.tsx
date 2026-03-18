import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bot, Settings, Activity, CircleDot, ShieldCheck, Wrench, Download, Loader2 as Spinner } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { relativeTime } from "@/features/cockpit/lib/format";
import { AgentIdentitySection } from "@/components/AgentIdentitySection";
import { AgentSkillAssignment } from "@/components/AgentSkillAssignment";
import { useAgentComposioTools } from "@/hooks/useAgentComposioTools";
import { VENICE_MODELS, VENICE_DEFAULT_MODEL } from "@/lib/venice/config";
import { getRunLogJson, triggerJsonDownload } from "@/lib/erc8004/download";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  running: "bg-cyan-500",
  active: "bg-emerald-500",
  paused: "bg-yellow-500",
  idle: "bg-yellow-500",
  error: "bg-red-500",
  terminated: "bg-zinc-500",
  pending_approval: "bg-orange-500",
};

interface AgentDetailRow {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
  adapter_config: Record<string, unknown> | null;
  capabilities: string | null;
  reports_to: string | null;
  seat_index: number;
  private_cognition_enabled: boolean;
  venice_model: string | null;
  created_at: string;
  updated_at: string;
}

interface RunRow {
  id: string;
  status: string;
  summary: string | null;
  created_at: string;
  total_cost_usd: number | null;
}

interface IssueRow {
  id: string;
  identifier: string | null;
  title: string;
  status: string;
  priority: string;
}

/** Small button to download a run's agent_log.json */
function RunLogDownloadButton({ runId }: { runId: string }) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating via the parent <Link>
    e.stopPropagation();
    setBusy(true);
    try {
      const log = await getRunLogJson(runId);
      triggerJsonDownload(log, "agent_log.json");
      toast.success("agent_log.json downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download run log");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={busy}
      className="h-6 gap-1 border-white/10 text-[10px] text-zinc-400 hover:bg-[#141b27] hover:text-white shrink-0"
      title="Download agent_log.json for this run"
    >
      {busy ? <Spinner className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
      Log
    </Button>
  );
}

function PropertyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500 shrink-0">
        {label}
      </span>
      <span className="text-sm text-zinc-300 text-right">{value ?? "—"}</span>
    </div>
  );
}

export function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: agent, isLoading } = useQuery<AgentDetailRow | null>({
    queryKey: ["agent-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as AgentDetailRow | null;
    },
    enabled: !!id,
  });

  const { data: runs = [] } = useQuery<RunRow[]>({
    queryKey: ["agent-runs", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("runs")
        .select("id, status, summary, created_at, total_cost_usd")
        .eq("agent_id", id!)
        .order("created_at", { ascending: false });

      if (error) return [];
      return (data ?? []) as RunRow[];
    },
    enabled: !!id,
  });

  const { data: issues = [] } = useQuery<IssueRow[]>({
    queryKey: ["agent-issues", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("issues")
        .select("id, identifier, title, status, priority")
        .eq("assignee_agent_id", id!)
        .order("created_at", { ascending: false });

      if (error) return [];
      return (data ?? []) as IssueRow[];
    },
    enabled: !!id,
  });

  const queryClient = useQueryClient();

  const togglePrivateCognition = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("agents")
        .update({ private_cognition_enabled: enabled })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-detail", id] });
    },
  });

  const updateVeniceModel = useMutation({
    mutationFn: async (model: string) => {
      const { error } = await supabase
        .from("agents")
        .update({ venice_model: model })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-detail", id] });
    },
  });

  const adapterLabel = useMemo(() => {
    if (!agent) return "—";
    return adapterRegistry.get(agent.adapter_type)?.label ?? agent.adapter_type;
  }, [agent]);

  const composioTools = useAgentComposioTools(agent?.adapter_config ?? null);

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-800" />
        <div className="h-48 animate-pulse rounded-2xl border border-white/10 bg-[#0d1118]" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6">
        <Card className="border-white/10 bg-[#0d1118]">
          <CardContent className="flex flex-col items-center gap-4 p-12">
            <Bot className="h-12 w-12 text-zinc-600" />
            <p className="text-zinc-300">Agent not found.</p>
            <Button asChild variant="outline">
              <Link to="/agents">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Agents
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="text-zinc-400 hover:text-white">
          <Link to="/agents">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${STATUS_COLORS[agent.status] ?? "bg-zinc-500"}`}
            title={agent.status}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-zinc-100">{agent.name}</h1>
              {agent.private_cognition_enabled && (
                <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Private AI
                </Badge>
              )}
            </div>
            <p className="text-sm text-zinc-500">{agent.title ?? agent.role}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        {/* Properties */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Settings className="h-4 w-4" />
              Agent Properties
            </CardTitle>
            <CardDescription className="text-zinc-500">Core configuration and identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-white/5">
            <PropertyRow label="Name" value={agent.name} />
            <PropertyRow label="Role" value={agent.role} />
            <PropertyRow label="Title" value={agent.title} />
            <PropertyRow
              label="Status"
              value={
                <Badge variant="outline" className="border-white/10 bg-black text-zinc-300">
                  {agent.status}
                </Badge>
              }
            />
            <PropertyRow label="Adapter Type" value={adapterLabel} />
            <PropertyRow label="Reports To" value={agent.reports_to ?? "None (root)"} />
            <PropertyRow label="Capabilities" value={agent.capabilities} />
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500 shrink-0">
                Private Cognition
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">
                  {agent.private_cognition_enabled ? "Enabled" : "Disabled"}
                </span>
                <Switch
                  checked={agent.private_cognition_enabled}
                  onCheckedChange={(checked) => togglePrivateCognition.mutate(checked)}
                  disabled={togglePrivateCognition.isPending}
                  aria-label="Toggle private cognition"
                />
              </div>
            </div>
            {agent.private_cognition_enabled && (
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500 shrink-0">
                  Venice Model
                </span>
                <Select
                  value={agent.venice_model ?? VENICE_DEFAULT_MODEL}
                  onValueChange={(value) => updateVeniceModel.mutate(value)}
                  disabled={updateVeniceModel.isPending}
                >
                  <SelectTrigger className="w-[200px] h-8 border-white/10 bg-black text-zinc-300 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENICE_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <PropertyRow label="Created" value={relativeTime(agent.created_at)} />
            <PropertyRow label="Updated" value={relativeTime(agent.updated_at)} />
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Adapter Configuration</CardTitle>
            <CardDescription className="text-zinc-500">
              {adapterLabel} adapter config JSON.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs text-zinc-300">
              {agent.adapter_config
                ? JSON.stringify(agent.adapter_config, null, 2)
                : "No configuration set."}
            </pre>
          </CardContent>
        </Card>
      </div>

      {/* Composio Tools (downstream availability) */}
      {composioTools.composioAvailable && composioTools.effectiveTools.length > 0 && (
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Wrench className="h-4 w-4" />
              Composio Tools
            </CardTitle>
            <CardDescription className="text-zinc-500">
              External tools available to this agent via Composio MCP.
              {composioTools.hasAgentOverride
                ? " (Agent-specific selection)"
                : " (Company default selection)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {composioTools.effectiveTools.map((tool) => (
                <Badge
                  key={tool}
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/5 font-mono text-[11px] text-blue-300"
                >
                  {tool}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills Assignment */}
      <AgentSkillAssignment agentId={id!} />

      {/* ERC-8004 Identity */}
      <AgentIdentitySection agentId={id!} />

      {/* Associated Data */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Runs */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Activity className="h-4 w-4" />
              Recent Runs
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Latest execution runs for this agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            ) : (
              runs.slice(0, 10).map((run) => (
                <Link
                  key={run.id}
                  to={`/runs/${run.id}`}
                  className="block rounded-xl border border-white/10 bg-[#080c14] p-3 hover:border-blue-500/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-zinc-100 truncate">
                      {run.summary ?? run.id.slice(0, 8)}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      <RunLogDownloadButton runId={run.id} />
                      <Badge variant="outline" className="border-white/10 bg-black text-zinc-400">
                        {run.status}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{relativeTime(run.created_at)}</p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Issues */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <CircleDot className="h-4 w-4" />
              Assigned Issues
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Issues assigned to this agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues assigned.</p>
            ) : (
              issues.slice(0, 10).map((issue) => (
                <Link
                  key={issue.id}
                  to={`/issues/${issue.id}`}
                  className="block rounded-xl border border-white/10 bg-[#080c14] p-3 hover:border-blue-500/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-zinc-100">{issue.identifier ?? issue.title}</p>
                      <p className="mt-0.5 text-sm text-zinc-400">{issue.title}</p>
                    </div>
                    <Badge variant="outline" className="border-white/10 bg-black text-zinc-400 shrink-0">
                      {issue.status}
                    </Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
