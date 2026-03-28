import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/* ---- Types ---- */

export interface AgentRow {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
}

const STATUS_DOT: Record<string, string> = {
  running: "bg-cyan-400",
  active: "bg-emerald-400",
  paused: "bg-yellow-400",
  idle: "bg-yellow-400",
  error: "bg-red-400",
  terminated: "bg-neutral-400",
  pending_approval: "bg-orange-400",
};

const ADAPTER_LABELS: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  cursor: "Cursor",
  gemini_local: "Gemini",
  opencode_local: "OpenCode",
  pi_local: "Pi",
  openclaw_gateway: "OpenClaw",
  process: "Process",
  http: "HTTP",
  hermes: "Hermes",
};

function isAgentActive(status: string): boolean {
  return status === "running" || status === "active";
}

interface ActiveAgentsPanelProps {
  agents: AgentRow[];
}

export function ActiveAgentsPanel({ agents }: ActiveAgentsPanelProps) {
  const activeAgents = agents.filter((a) => isAgentActive(a.status));

  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Active Agents
      </h3>
      {activeAgents.length === 0 ? (
        <div className="rounded-xl border border-border p-4 bg-[#0d1118]">
          <p className="text-sm text-muted-foreground">
            {agents.length === 0
              ? "No agents yet. Create your first agent to get started."
              : "No active agents."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          {activeAgents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentRow }) {
  const isActive = isAgentActive(agent.status);
  const dotClass = STATUS_DOT[agent.status] ?? "bg-neutral-400";

  return (
    <Link
      to={`/agents/${agent.id}`}
      className="no-underline text-inherit block"
    >
      <div
        className={cn(
          "flex flex-col rounded-xl border p-3 shadow-sm transition-colors",
          isActive
            ? "border-cyan-500/25 bg-cyan-500/[0.04] shadow-[0_16px_40px_rgba(6,182,212,0.08)] hover:border-cyan-500/40"
            : "border-border bg-[#0d1118] hover:border-blue-500/30",
        )}
      >
        <div className="flex items-center gap-2">
          {agent.status === "running" ? (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70" />
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", dotClass)} />
            </span>
          ) : (
            <span className={cn("inline-flex h-2.5 w-2.5 rounded-full shrink-0", dotClass)} />
          )}
          <span className="font-medium text-sm text-zinc-100 truncate">{agent.name}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="capitalize">{agent.status.replace(/_/g, " ")}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{ADAPTER_LABELS[agent.adapter_type] ?? agent.adapter_type}</span>
        </div>
        {agent.title && (
          <p className="mt-1 text-[11px] text-muted-foreground/70 truncate">{agent.title}</p>
        )}
      </div>
    </Link>
  );
}
