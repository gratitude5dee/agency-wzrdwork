import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useAgencyData } from "../lib/useAgencyData";
import { formatUsd, projectHref, relativeTime, issueHref, approvalHref, agentHref, runHref } from "../lib/format";
import { MetricCard } from "@/components/MetricCard";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "@/components/ActivityCharts";
import { ActiveAgentsPanel } from "@/components/ActiveAgentsPanel";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { PageLoadingState, PageEmptyState, PageErrorState } from "@/components/PageStateIndicators";
import { useAgentMetrics, useIssueMetrics, useRunMetrics, useApprovalMetrics } from "@/hooks/useDashboardMetrics";
import { useDashboardRuns, useDashboardIssues, useDashboardAgents, useDashboardActivity } from "@/hooks/useDashboardData";
import { useCompanySettings, useSupabaseHealth, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { FeatureTour } from "@/features/onboarding/steps/FeatureTour";
import { AlertTriangle, Bot, Building2, Check, CheckCircle2, CircleDot, Database, Filter, Loader2, MapPin, Palette, Play, Plus, RotateCcw, Settings2, ShieldCheck, Target, Unplug, Wallet, X, XCircle } from "lucide-react";
import { useDisconnect, useActiveWallet } from "thirdweb/react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { NewIssueDialog } from "../components/NewIssueDialog";
import type { AgencySnapshot, ApprovalStatus, GoalStatus, IssuePriority, IssueStatus, ProjectStatus } from "../lib/domain";

type SectionName =
  | "dashboard"
  | "inbox"
  | "issues"
  | "goals"
  | "approvals"
  | "projects"
  | "org"
  | "costs"
  | "activity"
  | "design-guide"
  | "settings";

function toneClass(tone: "default" | "warning" | "danger" | "success" | "info" = "default") {
  switch (tone) {
    case "warning":
      return "border-orange-500/20 bg-orange-500/10 text-orange-200";
    case "danger":
      return "border-red-500/20 bg-red-500/10 text-red-200";
    case "success":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "info":
      return "border-blue-500/20 bg-blue-500/10 text-blue-200";
    default:
      return "border-white/10 bg-[#0d1118] text-zinc-300";
  }
}

function SimpleMetricCard({ title, value, tone = "default" }: { title: string; value: string | number; tone?: Parameters<typeof toneClass>[0] }) {
  return (
    <Card className={`border ${toneClass(tone)}`}>
      <CardHeader className="pb-3">
        <CardDescription className="text-[11px] font-black uppercase tracking-[0.22em] text-inherit/70">
          {title}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-black">{value}</p>
      </CardContent>
    </Card>
  );
}

export function SectionPage({ section }: { section: SectionName }) {
  const { snapshot } = useAgencyData();
  const openIssues = snapshot.issues.filter((issue) => issue.status !== "done" && issue.status !== "cancelled");
  const liveRuns = snapshot.runs.filter((run) => run.status === "running" || run.status === "queued");
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === "pending");
  const totalCost = snapshot.runs.reduce((sum, run) => sum + (run.totalCostUsd ?? 0), 0);

  if (section === "dashboard") {
    return <DashboardSection snapshot={snapshot} />;
  }

  if (section === "inbox") {
    return <InboxSection snapshot={snapshot} />;
  }

  if (section === "issues") {
    return <IssuesSection snapshot={snapshot} />;
  }

  if (section === "goals") {
    return <GoalsSection snapshot={snapshot} />;
  }

  if (section === "approvals") {
    return <ApprovalsSection snapshot={snapshot} />;
  }

  if (section === "projects") {
    return <ProjectsSection snapshot={snapshot} />;
  }

  if (section === "org") {
    return (
      <div className="space-y-4 p-6">
        {snapshot.agents.map((agent) => (
          <Link key={agent.id} to={agentHref(agent.id)} className="block rounded-2xl border border-white/10 bg-[#0d1118] p-4 hover:border-blue-500/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-zinc-100">{agent.name}</p>
                <p className="mt-1 text-zinc-400">{agent.title ?? agent.role}</p>
              </div>
              <Badge variant="outline" className="border-white/10 bg-black text-zinc-300">
                {agent.status}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (section === "costs") {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <SimpleMetricCard title="Total runtime cost" value={formatUsd(totalCost)} tone="info" />
        <SimpleMetricCard title="Total runs" value={snapshot.runs.length} />
        <Card className="border-white/10 bg-[#0d1118] md:col-span-2">
          <CardHeader>
            <CardTitle className="text-zinc-100">Run costs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.runs.map((run) => (
              <Link key={run.id} to={runHref(run.id)} className="block rounded-xl border border-white/10 bg-[#080c14] p-3 hover:border-blue-500/30">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-zinc-100">{run.summary ?? run.id}</p>
                  <p className="text-sm text-zinc-400">{formatUsd(run.totalCostUsd)}</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (section === "activity") {
    return (
      <div className="space-y-4 p-6">
        {snapshot.activity.map((entry) => (
          <Card key={entry.id} className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="text-zinc-100">{entry.action.replace(/[._]/g, " ")}</CardTitle>
              <CardDescription className="text-zinc-500">{relativeTime(entry.createdAt)}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300">{entry.details ?? "No additional details."}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (section === "design-guide") {
    return (
      <div className="grid gap-4 p-6 md:grid-cols-2">
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Cockpit theme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-zinc-300">
            <p>Use the black control-plane shell as the default host language.</p>
            <p>Keep the 3D scene dominant, with side panels acting as operational context.</p>
            <p>Reserve bright colors for agent state, approvals, and live work accents.</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Backend expectations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-zinc-300">
            <p>Supabase is the runtime backend.</p>
            <p>Drizzle is provided for schema ownership and migrations.</p>
            <p>Demo data remains available so the cockpit still renders before the schema is applied.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (section === "settings") {
    return <SettingsSection snapshot={snapshot} />;
  }

  return (
    <div className="grid gap-4 p-6 xl:grid-cols-[1.3fr,0.7fr]">
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Environment</CardTitle>
          <CardDescription className="text-zinc-500">
            Current runtime mode and Supabase integration state.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-zinc-300">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">Source</p>
            <p className="mt-2 text-sm">{snapshot.source === "server" ? "Live orchestration server" : "Demo fallback snapshot"}</p>
          </div>
          <Separator className="bg-white/10" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">Message</p>
            <p className="mt-2 text-sm">{snapshot.sourceMessage ?? "The app is reading from the orchestration server."}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-[#0d1118]">
        <CardHeader>
          <CardTitle className="text-zinc-100">Setup checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-zinc-300">
          <p>1. Apply the Supabase SQL migration.</p>
          <p>2. Add `DATABASE_URL` for Drizzle and migration tooling.</p>
          <p>3. Keep `package-lock.json` as the install source of truth.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: status/priority badge styling                              */
/* ------------------------------------------------------------------ */

function statusBadgeClass(status: string): string {
  switch (status) {
    case "backlog": return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
    case "todo": return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "in_progress": return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "in_review": return "border-purple-500/30 bg-purple-500/10 text-purple-300";
    case "blocked": return "border-red-500/30 bg-red-500/10 text-red-300";
    case "done": case "complete": case "approved": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "cancelled": case "rejected": return "border-zinc-500/30 bg-zinc-500/10 text-zinc-400";
    case "pending": return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "planned": return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
    case "active": return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "at_risk": return "border-red-500/30 bg-red-500/10 text-red-300";
    case "paused": return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    case "revision_requested": return "border-yellow-500/30 bg-yellow-500/10 text-yellow-300";
    default: return "border-white/10 bg-white/5 text-zinc-300";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "critical": return "border-red-500/30 bg-red-500/10 text-red-300";
    case "high": return "border-orange-500/30 bg-orange-500/10 text-orange-300";
    case "medium": return "border-blue-500/30 bg-blue-500/10 text-blue-300";
    case "low": return "border-zinc-500/30 bg-zinc-500/10 text-zinc-300";
    default: return "border-white/10 bg-white/5 text-zinc-300";
  }
}

function SectionEmpty({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
      <Icon className="h-10 w-10 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inbox Section                                                      */
/* ------------------------------------------------------------------ */

function InboxSection({ snapshot }: { snapshot: AgencySnapshot }) {
  const agentName = (id: string | null) => snapshot.agents.find((a) => a.id === id)?.name ?? "Unknown";
  const pendingApprovals = snapshot.approvals.filter((a) => a.status === "pending");
  const blockedIssues = snapshot.issues.filter((i) => i.status === "blocked");
  const failedRuns = snapshot.runs.filter((r) => r.status === "failed");

  const allItems = [
    ...pendingApprovals.map((a) => ({ type: "approval" as const, id: a.id, time: a.createdAt, data: a })),
    ...blockedIssues.map((i) => ({ type: "issue" as const, id: i.id, time: i.createdAt, data: i })),
    ...failedRuns.map((r) => ({ type: "run" as const, id: r.id, time: r.createdAt, data: r })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-black text-zinc-100">Inbox</h2>
      <Tabs defaultValue="all">
        <TabsList className="border-white/10 bg-[#080c14]">
          <TabsTrigger value="all">All ({allItems.length})</TabsTrigger>
          <TabsTrigger value="approvals">Approvals ({pendingApprovals.length})</TabsTrigger>
          <TabsTrigger value="blocked">Blocked ({blockedIssues.length})</TabsTrigger>
          <TabsTrigger value="failed">Failed Runs ({failedRuns.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {allItems.length === 0 && <SectionEmpty icon={CheckCircle2} message="Inbox is clear — nothing needs attention." />}
          {allItems.map((item) => {
            if (item.type === "approval") return <InboxApprovalCard key={item.id} approval={item.data as any} agentName={agentName} />;
            if (item.type === "issue") return <InboxIssueCard key={item.id} issue={item.data as any} agentName={agentName} />;
            return <InboxRunCard key={item.id} run={item.data as any} agentName={agentName} />;
          })}
        </TabsContent>

        <TabsContent value="approvals" className="mt-4 space-y-3">
          {pendingApprovals.length === 0 && <SectionEmpty icon={ShieldCheck} message="No pending approvals." />}
          {pendingApprovals.map((a) => <InboxApprovalCard key={a.id} approval={a} agentName={agentName} />)}
        </TabsContent>

        <TabsContent value="blocked" className="mt-4 space-y-3">
          {blockedIssues.length === 0 && <SectionEmpty icon={CircleDot} message="No blocked issues." />}
          {blockedIssues.map((i) => <InboxIssueCard key={i.id} issue={i} agentName={agentName} />)}
        </TabsContent>

        <TabsContent value="failed" className="mt-4 space-y-3">
          {failedRuns.length === 0 && <SectionEmpty icon={Play} message="No failed runs." />}
          {failedRuns.map((r) => <InboxRunCard key={r.id} run={r} agentName={agentName} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InboxApprovalCard({ approval, agentName }: { approval: AgencySnapshot["approvals"][0]; agentName: (id: string | null) => string }) {
  return (
    <Link to={approvalHref(approval.id)} className="block rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 hover:border-orange-500/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className={statusBadgeClass("pending")}>Approval</Badge>
            <span className="text-xs text-zinc-500">{relativeTime(approval.createdAt)}</span>
          </div>
          <p className="font-bold text-zinc-100">{approval.summary}</p>
          <p className="text-sm text-zinc-400">Requested by {agentName(approval.requestedByAgentId)}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-7 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
            <Check className="h-3 w-3 mr-1" /> Approve
          </Button>
          <Button size="sm" variant="outline" className="h-7 border-red-500/30 text-red-300 hover:bg-red-500/10">
            <X className="h-3 w-3 mr-1" /> Reject
          </Button>
        </div>
      </div>
    </Link>
  );
}

function InboxIssueCard({ issue, agentName }: { issue: AgencySnapshot["issues"][0]; agentName: (id: string | null) => string }) {
  return (
    <Link to={issueHref(issue.id)} className="block rounded-xl border border-red-500/20 bg-red-500/5 p-4 hover:border-red-500/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className={statusBadgeClass("blocked")}>Blocked</Badge>
            <span className="text-xs text-zinc-500">{relativeTime(issue.createdAt)}</span>
          </div>
          <p className="font-bold text-zinc-100">{issue.identifier ?? issue.title}</p>
          <p className="text-sm text-zinc-400">Assigned to {agentName(issue.assigneeAgentId)}</p>
        </div>
      </div>
    </Link>
  );
}

function InboxRunCard({ run, agentName }: { run: AgencySnapshot["runs"][0]; agentName: (id: string | null) => string }) {
  return (
    <Link to={runHref(run.id)} className="block rounded-xl border border-red-500/20 bg-red-500/5 p-4 hover:border-red-500/40 transition-colors">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge className={statusBadgeClass("cancelled")}>Failed Run</Badge>
          <span className="text-xs text-zinc-500">{relativeTime(run.createdAt)}</span>
        </div>
        <p className="font-bold text-zinc-100">{run.summary ?? "Unnamed run"}</p>
        {run.error && <p className="text-sm text-red-300/80 line-clamp-2">{run.error}</p>}
        <p className="text-sm text-zinc-400">Agent: {agentName(run.agentId)}</p>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Issues Section                                                     */
/* ------------------------------------------------------------------ */

function IssuesSection({ snapshot }: { snapshot: AgencySnapshot }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const agentName = (id: string | null) => snapshot.agents.find((a) => a.id === id)?.name ?? "Unassigned";

  const filtered = useMemo(() => {
    return snapshot.issues.filter((issue) => {
      if (statusFilter !== "all" && issue.status !== statusFilter) return false;
      if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && (issue.assigneeAgentId ?? "unassigned") !== assigneeFilter) return false;
      return true;
    });
  }, [snapshot.issues, statusFilter, priorityFilter, assigneeFilter]);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black text-zinc-100">Issues</h2>
        <NewIssueDialog />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-zinc-500" />
          <span className="text-xs text-zinc-500 uppercase tracking-wider">Filters</span>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 border-white/10 bg-[#0d1118] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="in_review">In Review</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 w-32 border-white/10 bg-[#0d1118] text-xs">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
          <SelectTrigger className="h-8 w-36 border-white/10 bg-[#0d1118] text-xs">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
            <SelectItem value="all">All agents</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {snapshot.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || priorityFilter !== "all" || assigneeFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-7 text-xs text-zinc-400" onClick={() => { setStatusFilter("all"); setPriorityFilter("all"); setAssigneeFilter("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Issue list */}
      <div className="space-y-2">
        {filtered.length === 0 && <SectionEmpty icon={CircleDot} message="No issues match the current filters." />}
        {filtered.map((issue) => (
          <Link key={issue.id} to={issueHref(issue.id)} className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#0d1118] p-4 hover:border-blue-500/30 transition-colors">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                {issue.identifier && <span className="text-xs font-mono text-zinc-500">{issue.identifier}</span>}
                <p className="font-bold text-zinc-100 truncate">{issue.title}</p>
              </div>
              <p className="text-sm text-zinc-400">{agentName(issue.assigneeAgentId)} · {relativeTime(issue.updatedAt)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={`text-[10px] ${priorityBadgeClass(issue.priority)}`}>{issue.priority}</Badge>
              <Badge className={`text-[10px] ${statusBadgeClass(issue.status)}`}>{issue.status.replace("_", " ")}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Goals Section                                                      */
/* ------------------------------------------------------------------ */

function GoalsSection({ snapshot }: { snapshot: AgencySnapshot }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<GoalStatus>("planned");
  const [ownerAgentId, setOwnerAgentId] = useState<string>("none");
  const [creating, setCreating] = useState(false);

  const agentName = (id: string | null) => snapshot.agents.find((a) => a.id === id)?.name ?? "Unassigned";

  async function handleCreateGoal() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      await supabase.from("goals").insert({
        company_id: snapshot.company.id,
        title: title.trim(),
        summary: summary.trim(),
        status,
        owner_agent_id: ownerAgentId === "none" ? null : ownerAgentId,
      });
      await queryClient.invalidateQueries({ queryKey: ["agency-snapshot"] });
      toast.success("Goal created");
      setTitle(""); setSummary(""); setStatus("planned"); setOwnerAgentId("none");
      setDialogOpen(false);
    } catch (e) {
      toast.error("Failed to create goal");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black text-zinc-100">Goals</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-white text-black hover:bg-zinc-100"><Plus className="h-4 w-4" /> New Goal</Button>
          </DialogTrigger>
          <DialogContent className="border-white/10 bg-[#0a0f18] text-zinc-100 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Goal</DialogTitle>
              <DialogDescription className="text-zinc-400">Set a strategic objective for your team.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="border-white/10 bg-[#101722]" placeholder="Ship v2 by end of Q3" /></div>
              <div className="grid gap-2"><Label>Summary</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-20 border-white/10 bg-[#101722]" placeholder="Describe the goal..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
                    <SelectTrigger className="border-white/10 bg-[#101722]"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
                      <SelectItem value="planned">Planned</SelectItem><SelectItem value="active">Active</SelectItem>
                      <SelectItem value="complete">Complete</SelectItem><SelectItem value="at_risk">At Risk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Owner</Label>
                  <Select value={ownerAgentId} onValueChange={setOwnerAgentId}>
                    <SelectTrigger className="border-white/10 bg-[#101722]"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
                      <SelectItem value="none">No owner</SelectItem>
                      {snapshot.agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-zinc-400">Cancel</Button>
              <Button onClick={handleCreateGoal} disabled={creating} className="gap-2 bg-blue-500 text-white hover:bg-blue-400">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {snapshot.goals.length === 0 && <SectionEmpty icon={Target} message="No goals yet. Create one to track strategic objectives." />}
      <div className="grid gap-3 md:grid-cols-2">
        {snapshot.goals.map((goal) => (
          <Card key={goal.id} className="border-white/10 bg-[#0d1118]">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-zinc-100 text-base">{goal.title}</CardTitle>
                <Badge className={`text-[10px] shrink-0 ${statusBadgeClass(goal.status)}`}>{goal.status.replace("_", " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-zinc-400 line-clamp-2">{goal.summary || "No summary"}</p>
              <p className="text-xs text-zinc-500">Owner: {agentName(goal.ownerAgentId)} · {relativeTime(goal.updatedAt)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Approvals Section                                                  */
/* ------------------------------------------------------------------ */

function ApprovalsSection({ snapshot }: { snapshot: AgencySnapshot }) {
  const agentName = (id: string | null) => snapshot.agents.find((a) => a.id === id)?.name ?? "Unknown";
  const pending = snapshot.approvals.filter((a) => a.status === "pending");
  const approved = snapshot.approvals.filter((a) => a.status === "approved");
  const rejected = snapshot.approvals.filter((a) => a.status === "rejected" || a.status === "revision_requested");

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-xl font-black text-zinc-100">Approvals</h2>
      <Tabs defaultValue="pending">
        <TabsList className="border-white/10 bg-[#080c14]">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({approved.length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
          <TabsTrigger value="all">All ({snapshot.approvals.length})</TabsTrigger>
        </TabsList>

        {(["pending", "approved", "rejected", "all"] as const).map((tab) => {
          const items = tab === "all" ? snapshot.approvals : tab === "pending" ? pending : tab === "approved" ? approved : rejected;
          return (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {items.length === 0 && <SectionEmpty icon={ShieldCheck} message={`No ${tab} approvals.`} />}
              {items.map((approval) => (
                <Link key={approval.id} to={approvalHref(approval.id)} className="block rounded-xl border border-white/10 bg-[#0d1118] p-4 hover:border-orange-500/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-[10px] ${statusBadgeClass(approval.status)}`}>{approval.status.replace("_", " ")}</Badge>
                        <span className="text-xs text-zinc-500">{relativeTime(approval.createdAt)}</span>
                      </div>
                      <p className="font-bold text-zinc-100">{approval.summary}</p>
                      <p className="text-sm text-zinc-400">By {agentName(approval.requestedByAgentId)}</p>
                      {approval.details && <p className="text-sm text-zinc-500 line-clamp-2">{approval.details}</p>}
                      {approval.resolutionNote && (
                        <p className="text-sm text-zinc-400 italic border-l-2 border-zinc-700 pl-2 mt-1">{approval.resolutionNote}</p>
                      )}
                    </div>
                    {approval.status === "pending" && (
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="h-7 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 border-red-500/30 text-red-300 hover:bg-red-500/10">
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Projects Section                                                   */
/* ------------------------------------------------------------------ */

function ProjectsSection({ snapshot }: { snapshot: AgencySnapshot }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planned");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [creating, setCreating] = useState(false);

  async function handleCreateProject() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await supabase.from("projects").insert({
        company_id: snapshot.company.id,
        name: name.trim(),
        summary: summary.trim(),
        status,
        priority,
      });
      await queryClient.invalidateQueries({ queryKey: ["agency-snapshot"] });
      toast.success("Project created");
      setName(""); setSummary(""); setStatus("planned"); setPriority("medium");
      setDialogOpen(false);
    } catch (e) {
      toast.error("Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-black text-zinc-100">Projects</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-white text-black hover:bg-zinc-100"><Plus className="h-4 w-4" /> New Project</Button>
          </DialogTrigger>
          <DialogContent className="border-white/10 bg-[#0a0f18] text-zinc-100 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
              <DialogDescription className="text-zinc-400">Organize work under a project.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="border-white/10 bg-[#101722]" placeholder="Mobile App Redesign" /></div>
              <div className="grid gap-2"><Label>Summary</Label><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-20 border-white/10 bg-[#101722]" placeholder="Describe the project..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2"><Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                    <SelectTrigger className="border-white/10 bg-[#101722]"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
                      <SelectItem value="planned">Planned</SelectItem><SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem><SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Priority</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as IssuePriority)}>
                    <SelectTrigger className="border-white/10 bg-[#101722]"><SelectValue /></SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#0f141d] text-zinc-100">
                      <SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-zinc-400">Cancel</Button>
              <Button onClick={handleCreateProject} disabled={creating} className="gap-2 bg-blue-500 text-white hover:bg-blue-400">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {snapshot.projects.length === 0 && <SectionEmpty icon={Building2} message="No projects yet. Create one to organize work." />}
      <div className="grid gap-3 md:grid-cols-2">
        {snapshot.projects.map((project) => {
          const projectIssues = snapshot.issues.filter((i) => i.projectId === project.id);
          const doneCount = projectIssues.filter((i) => i.status === "done").length;
          const progress = projectIssues.length > 0 ? Math.round((doneCount / projectIssues.length) * 100) : 0;
          return (
            <Link key={project.id} to={projectHref(project.id)} className="block">
              <Card className="border-white/10 bg-[#0d1118] hover:border-blue-500/30 transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-zinc-100 text-base">{project.name}</CardTitle>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge className={`text-[10px] ${priorityBadgeClass(project.priority)}`}>{project.priority}</Badge>
                      <Badge className={`text-[10px] ${statusBadgeClass(project.status)}`}>{project.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-zinc-400 line-clamp-2">{project.summary || "No summary"}</p>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{doneCount}/{projectIssues.length} issues done</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}


/*  to the active company. Every panel has intentional empty states.   */
/*  (VAL-DASH-001, VAL-DASH-002, VAL-DASH-003)                       */
/* ------------------------------------------------------------------ */

function DashboardSection({ snapshot }: { snapshot: AgencySnapshot }) {
  // Metric card aggregates
  const { data: agentMetrics, isLoading: agentMetricsLoading, isError: agentMetricsErr, refetch: refetchAgentMetrics } = useAgentMetrics();
  const { data: issueMetrics, isLoading: issueMetricsLoading, isError: issueMetricsErr, refetch: refetchIssueMetrics } = useIssueMetrics();
  const { data: runMetrics, isLoading: runMetricsLoading, isError: runMetricsErr, refetch: refetchRunMetrics } = useRunMetrics();
  const { data: approvalCount, isLoading: approvalMetricsLoading, isError: approvalMetricsErr, refetch: refetchApprovalMetrics } = useApprovalMetrics();

  // Chart + panel row data — from dedicated Supabase hooks
  const { data: liveRuns = [], isLoading: runsLoading, isError: runsErr, refetch: refetchRuns } = useDashboardRuns();
  const { data: liveIssues = [], isLoading: issuesLoading, isError: issuesErr, refetch: refetchIssues } = useDashboardIssues();
  const { data: liveAgents = [], isLoading: agentsLoading, isError: agentsErr, refetch: refetchAgents } = useDashboardAgents();
  const { data: liveActivity = [], isLoading: activityLoading, isError: activityErr, refetch: refetchActivity } = useDashboardActivity();

  const isDemoMode = snapshot.source !== "server";

  // Determine if we're in initial loading of core data
  const metricsLoading = agentMetricsLoading || issueMetricsLoading || runMetricsLoading || approvalMetricsLoading;

  // Determine if all primary queries errored out (total failure)
  const allMetricsError = agentMetricsErr && issueMetricsErr && runMetricsErr && approvalMetricsErr;
  const allDataError = runsErr && issuesErr && agentsErr && activityErr;

  // If everything failed, show full-page error
  if (allMetricsError && allDataError) {
    return (
      <PageErrorState
        message="Failed to load dashboard data. Check your connection and try again."
        onRetry={() => {
          refetchAgentMetrics();
          refetchIssueMetrics();
          refetchRunMetrics();
          refetchApprovalMetrics();
          refetchRuns();
          refetchIssues();
          refetchAgents();
          refetchActivity();
        }}
      />
    );
  }

  // Urgent issues: blocked, critical, or high priority (open only)
  const urgentIssues = liveIssues.filter(
    (i) =>
      i.status !== "done" &&
      i.status !== "cancelled" &&
      (i.status === "blocked" || i.priority === "critical" || i.priority === "high"),
  );

  // Build an agent name lookup from live agents for activity display
  const agentNameMap = new Map(liveAgents.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6 p-6">
      {/* Demo mode banner — visible when not reading from live Supabase data */}
      {isDemoMode && (
        <DemoModeBanner message={snapshot.sourceMessage} />
      )}

      {/* Metric Cards — sourced directly from Supabase */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        <MetricCard
          icon={Bot}
          value={metricsLoading ? "…" : (agentMetrics?.total ?? 0)}
          label="Agents"
          to="/org"
          description={
            metricsLoading ? (
              <span className="text-muted-foreground/50">Loading…</span>
            ) : agentMetrics && agentMetrics.total > 0 ? (
              <span>
                {agentMetrics.running} running{", "}
                {agentMetrics.active} active
              </span>
            ) : (
              <span>No agents yet</span>
            )
          }
        />
        <MetricCard
          icon={CircleDot}
          value={metricsLoading ? "…" : (issueMetrics?.open ?? 0)}
          label="Open Issues"
          to="/issues"
          description={
            metricsLoading ? (
              <span className="text-muted-foreground/50">Loading…</span>
            ) : issueMetrics && issueMetrics.open > 0 ? (
              <span>
                {issueMetrics.inProgress} in progress{", "}
                {issueMetrics.blocked} blocked
              </span>
            ) : (
              <span>No open issues</span>
            )
          }
        />
        <MetricCard
          icon={Play}
          value={metricsLoading ? "…" : (runMetrics?.live ?? 0)}
          label="Live Runs"
          to="/cockpit"
          description={
            metricsLoading ? (
              <span className="text-muted-foreground/50">Loading…</span>
            ) : runMetrics && (runMetrics.succeeded > 0 || runMetrics.failed > 0) ? (
              <span>
                {runMetrics.succeeded} succeeded{", "}
                {runMetrics.failed} failed
              </span>
            ) : (
              <span>No runs yet</span>
            )
          }
        />
        <MetricCard
          icon={ShieldCheck}
          value={metricsLoading ? "…" : (approvalCount ?? 0)}
          label="Pending Approvals"
          to="/approvals"
          description={
            metricsLoading ? (
              <span className="text-muted-foreground/50">Loading…</span>
            ) : approvalCount && approvalCount > 0 ? (
              <span>Awaiting review</span>
            ) : (
              <span>No pending approvals</span>
            )
          }
        />
      </div>

      {/* Active Agents Panel — from dedicated Supabase hook */}
      {agentsLoading ? (
        <DashboardLoadingBlock label="Loading agents…" />
      ) : (
        <ActiveAgentsPanel agents={liveAgents} />
      )}

      {/* Activity Charts — each uses live Supabase rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ChartCard title="Run Activity" subtitle="Last 14 days">
          {runsLoading ? (
            <DashboardLoadingBlock label="Loading…" compact />
          ) : (
            <RunActivityChart runs={liveRuns} />
          )}
        </ChartCard>
        <ChartCard title="Issues by Priority" subtitle="Last 14 days">
          {issuesLoading ? (
            <DashboardLoadingBlock label="Loading…" compact />
          ) : (
            <PriorityChart issues={liveIssues} />
          )}
        </ChartCard>
        <ChartCard title="Issues by Status" subtitle="Last 14 days">
          {issuesLoading ? (
            <DashboardLoadingBlock label="Loading…" compact />
          ) : (
            <IssueStatusChart issues={liveIssues} />
          )}
        </ChartCard>
        <ChartCard title="Success Rate" subtitle="Last 14 days">
          {runsLoading ? (
            <DashboardLoadingBlock label="Loading…" compact />
          ) : (
            <SuccessRateChart runs={liveRuns} />
          )}
        </ChartCard>
      </div>

      {/* Urgent Issues + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Urgent / Blocked Issues</CardTitle>
            <CardDescription className="text-zinc-500">
              Critical, high-priority, or blocked work items.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {issuesLoading ? (
              <DashboardLoadingBlock label="Loading issues…" compact />
            ) : urgentIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No urgent issues — all clear.</p>
            ) : (
              urgentIssues.slice(0, 5).map((issue) => (
                <Link
                  key={issue.id}
                  to={issueHref(issue.id)}
                  className="block rounded-xl border border-white/10 bg-[#080c14] p-3 hover:border-blue-500/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {issue.identifier ?? issue.id.slice(0, 8)}
                      </span>
                      <span className="font-bold text-zinc-100 truncate">{issue.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="border-white/10 bg-black text-zinc-400 text-[10px]">
                        {issue.priority}
                      </Badge>
                      <Badge variant="outline" className="border-white/10 bg-black text-zinc-400 text-[10px]">
                        {issue.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  {issue.assignee_agent_id && agentNameMap.has(issue.assignee_agent_id) && (
                    <p className="mt-1.5 text-xs text-muted-foreground/70">
                      Assigned to {agentNameMap.get(issue.assignee_agent_id)}
                    </p>
                  )}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent Activity</CardTitle>
            <CardDescription className="text-zinc-500">
              Latest events from the company timeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activityLoading ? (
              <DashboardLoadingBlock label="Loading activity…" compact />
            ) : liveActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              liveActivity.slice(0, 10).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-white/10 bg-[#080c14] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-zinc-100">{entry.action.replace(/[._]/g, " ")}</p>
                    {entry.agent_id && agentNameMap.has(entry.agent_id) && (
                      <span className="text-[10px] text-muted-foreground/60 shrink-0">
                        {agentNameMap.get(entry.agent_id)}
                      </span>
                    )}
                  </div>
                  {entry.details && (
                    <p className="mt-1 text-sm text-zinc-400">{entry.details}</p>
                  )}
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-600">
                    {relativeTime(entry.created_at)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Reusable loading indicator for dashboard sections */
function DashboardLoadingBlock({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${compact ? "py-2" : "rounded-xl border border-border p-4 bg-[#0d1118]"}`}>
      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings section — company info, backend status, replay tour,     */
/*  onboarding reset (VAL-SET-001, VAL-SET-002)                       */
/* ------------------------------------------------------------------ */

function SettingsSection({ snapshot }: { snapshot: AgencySnapshot }) {
  const { data: company, isLoading: companyLoading, isError: companyError, error: companyQueryError, refetch: refetchCompany } = useCompanySettings();
  const { data: supabaseHealthy } = useSupabaseHealth();
  const updateCompany = useUpdateCompanySettings();
  const onboarding = useOnboardingState(company?.wallet_address ?? null);
  const wallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const [showTour, setShowTour] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBrief, setEditBrief] = useState("");
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  if (companyLoading) {
    return <PageLoadingState label="Loading settings…" rows={3} />;
  }

  if (companyError) {
    return (
      <PageErrorState
        message={
          companyQueryError instanceof Error
            ? companyQueryError.message
            : "Failed to load company settings."
        }
        onRetry={() => refetchCompany()}
      />
    );
  }

  if (showTour) {
    return (
      <div className="p-6">
        <FeatureTour
          onComplete={() => {
            setShowTour(false);
            toast.success("Tour completed!");
          }}
        />
      </div>
    );
  }

  const handleStartEdit = () => {
    setEditName(company?.name ?? snapshot.company.name);
    setEditBrief(company?.brief ?? "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const patch: Record<string, string> = {};
    if (editName.trim() && editName !== company?.name) {
      patch.name = editName.trim();
    }
    if (editBrief !== (company?.brief ?? "")) {
      patch.brief = editBrief.trim();
    }
    if (Object.keys(patch).length > 0) {
      updateCompany.mutate(patch, {
        onSuccess: () => {
          toast.success("Company profile updated.");
          setIsEditing(false);
        },
        onError: () => {
          toast.error("Failed to update company profile.");
        },
      });
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Company Information */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Building2 className="h-4 w-4" />
              Company Information
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Your organization details from Supabase.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Company Name
              </p>
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-2 w-full rounded border border-white/10 bg-[#080c14] px-2 py-1 text-sm text-zinc-200 focus:border-blue-500/50 focus:outline-none"
                />
              ) : (
                <p className="mt-2 text-sm">
                  {companyLoading ? "Loading…" : company?.name ?? snapshot.company.name}
                </p>
              )}
            </div>
            <Separator className="bg-white/10" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Brief
              </p>
              {isEditing ? (
                <textarea
                  value={editBrief}
                  onChange={(e) => setEditBrief(e.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded border border-white/10 bg-[#080c14] px-2 py-1 text-sm text-zinc-200 focus:border-blue-500/50 focus:outline-none resize-none"
                />
              ) : (
                <p className="mt-2 text-sm">
                  {companyLoading ? "Loading…" : company?.brief || "No brief set"}
                </p>
              )}
            </div>
            <Separator className="bg-white/10" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Wallet Address
              </p>
              <p className="mt-2 flex items-center gap-2 text-sm font-mono">
                <Wallet className="h-3.5 w-3.5 text-zinc-500" />
                {companyLoading
                  ? "Loading…"
                  : company?.wallet_address ?? "Not connected"}
              </p>
            </div>
            <div className="pt-2">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateCompany.isPending}
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {updateCompany.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button
                    onClick={() => setIsEditing(false)}
                    disabled={updateCompany.isPending}
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-zinc-300 hover:bg-[#141b27]"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleStartEdit}
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-zinc-200 hover:bg-[#141b27] hover:text-white"
                >
                  <Building2 className="mr-2 h-3.5 w-3.5" />
                  Edit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Backend Status */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Database className="h-4 w-4" />
              Backend Status
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Supabase connection and data source.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Connection
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    supabaseHealthy ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                {supabaseHealthy ? "Connected" : "Disconnected"}
              </div>
            </div>
            <Separator className="bg-white/10" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Data Source
              </p>
              <p className="mt-2 text-sm">
                {snapshot.source === "server"
                  ? "Live orchestration server"
                  : "Demo fallback snapshot"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Replay Tour */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <MapPin className="h-4 w-4" />
              Feature Tour
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Revisit the guided walkthrough of the platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowTour(true)}
              variant="outline"
              className="border-white/10 text-zinc-200 hover:bg-[#141b27] hover:text-white"
            >
              <MapPin className="mr-2 h-4 w-4" />
              Replay Tour
            </Button>
          </CardContent>
        </Card>

        {/* Onboarding Reset */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <RotateCcw className="h-4 w-4" />
              Onboarding
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Reset onboarding to re-run the setup wizard on next visit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-zinc-400">
              Status:{" "}
              <span className={onboarding.isCompleted ? "text-emerald-400" : "text-amber-400"}>
                {onboarding.isCompleted ? "Completed" : "In progress"}
              </span>
            </p>
            <Button
              onClick={() => {
                setIsResetting(true);
                onboarding.resetOnboarding();
                toast.success("Onboarding reset. The wizard will appear on next visit.");
                // Small delay to allow the mutation to settle before the gate re-evaluates
                setTimeout(() => setIsResetting(false), 500);
              }}
              disabled={isResetting}
              variant="outline"
              className="border-white/10 text-zinc-200 hover:bg-[#141b27] hover:text-white"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {isResetting ? "Resetting…" : "Reset Onboarding"}
            </Button>
          </CardContent>
        </Card>

        {/* Defaults */}
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-zinc-100">
              <Settings2 className="h-4 w-4" />
              Defaults
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Company-wide default settings and preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-zinc-300">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Company Type
              </p>
              <p className="mt-2 text-sm">
                {companyLoading ? "Loading…" : company?.company_type ?? snapshot.company.companyType ?? "—"}
              </p>
            </div>
            <Separator className="bg-white/10" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Brand Color
              </p>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Palette className="h-3.5 w-3.5 text-zinc-500" />
                {companyLoading ? (
                  "Loading…"
                ) : company?.brand_color ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-4 w-4 rounded border border-white/10"
                      style={{ backgroundColor: company.brand_color }}
                    />
                    {company.brand_color}
                  </span>
                ) : (
                  "Not set"
                )}
              </div>
            </div>
            <Separator className="bg-white/10" />
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                Slug
              </p>
              <p className="mt-2 text-sm font-mono">
                {companyLoading ? "Loading…" : company?.slug ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-500/20 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Destructive actions that affect your session and wallet connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-sm font-bold text-red-300">Disconnect Wallet</p>
              <p className="mt-1 text-xs text-zinc-400">
                {wallet
                  ? "Disconnects your wallet and signs you out of this session. Your company data will remain intact and you can reconnect at any time."
                  : "No wallet is currently connected. Connect a wallet to enable this action."}
              </p>
              {showDisconnectConfirm ? (
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    onClick={() => {
                      if (wallet) {
                        disconnect(wallet);
                        toast.success("Wallet disconnected. You have been signed out.");
                        navigate("/");
                      }
                      setShowDisconnectConfirm(false);
                    }}
                    size="sm"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Unplug className="mr-2 h-3.5 w-3.5" />
                    Confirm Disconnect
                  </Button>
                  <Button
                    onClick={() => setShowDisconnectConfirm(false)}
                    size="sm"
                    variant="outline"
                    className="border-white/10 text-zinc-300 hover:bg-[#141b27]"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowDisconnectConfirm(true)}
                  disabled={!wallet}
                  size="sm"
                  variant="outline"
                  className="mt-3 border-red-500/20 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                >
                  <Unplug className="mr-2 h-3.5 w-3.5" />
                  Disconnect Wallet
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
