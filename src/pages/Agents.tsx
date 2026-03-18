import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { adapterRegistry } from "@/adapters/registry";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { PageLoadingState, PageEmptyState, PageErrorState } from "@/components/PageStateIndicators";

interface AgentRow {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
}

const STATUS_COLORS: Record<string, string> = {
  running: "bg-cyan-500",
  active: "bg-emerald-500",
  paused: "bg-yellow-500",
  idle: "bg-yellow-500",
  error: "bg-red-500",
  terminated: "bg-zinc-500",
  pending_approval: "bg-orange-500",
};

function adapterLabel(type: string): string {
  return adapterRegistry.get(type)?.label ?? type;
}

export function AgentsPage() {
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  const {
    data: agents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AgentRow[]>({
    queryKey: ["agents-list", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, role, title, status, adapter_type")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as AgentRow[];
    },
  });

  if (isLoading || companyLoading) {
    return <PageLoadingState label="Loading agents…" />;
  }

  if (isError) {
    return (
      <PageErrorState
        message={error instanceof Error ? error.message : "Failed to load agents."}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-100">Agents</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your AI agents — create, configure, and monitor.
          </p>
        </div>
        <Button asChild className="gap-2 w-full sm:w-auto">
          <Link to="/agents/new">
            <Plus className="h-4 w-4" />
            New Agent
          </Link>
        </Button>
      </div>

      {/* Agent List */}
      {agents.length === 0 ? (
        <PageEmptyState
          icon={Bot}
          title="No agents yet"
          description="Create your first agent to get started."
          action={
            <Button asChild>
              <Link to="/agents/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              to={`/agents/${agent.id}`}
              className="block rounded-2xl border border-white/10 bg-[#0d1118] p-4 transition-colors hover:border-blue-500/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLORS[agent.status] ?? "bg-zinc-500"}`}
                    title={agent.status}
                  />
                  <div className="min-w-0">
                    <p className="font-black text-zinc-100 truncate">{agent.name}</p>
                    <p className="mt-0.5 text-sm text-zinc-400 truncate">
                      {agent.title ?? agent.role}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="border-white/10 bg-black text-zinc-400">
                    {agent.role}
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-black text-zinc-400">
                    {adapterLabel(agent.adapter_type)}
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-black text-zinc-300">
                    {agent.status}
                  </Badge>
                </div>
                {/* Mobile: compact status badge */}
                <Badge variant="outline" className="border-white/10 bg-black text-zinc-300 sm:hidden shrink-0">
                  {agent.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
