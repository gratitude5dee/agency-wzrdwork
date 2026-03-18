import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAgencyData } from "../lib/useAgencyData";
import { formatUsd, projectHref, relativeTime, issueHref, approvalHref, agentHref, runHref } from "../lib/format";
import { MetricCard } from "@/components/MetricCard";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "@/components/ActivityCharts";
import { ActiveAgentsPanel } from "@/components/ActiveAgentsPanel";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { useAgentMetrics, useIssueMetrics, useRunMetrics, useApprovalMetrics } from "@/hooks/useDashboardMetrics";
import { useDashboardRuns, useDashboardIssues, useDashboardAgents, useDashboardActivity } from "@/hooks/useDashboardData";
import { useCompanySettings, useSupabaseHealth } from "@/hooks/useCompanySettings";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { FeatureTour } from "@/features/onboarding/steps/FeatureTour";
import { Bot, Building2, CircleDot, Database, Loader2, MapPin, Play, RotateCcw, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import type { AgencySnapshot } from "../lib/domain";

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
    return (
      <div className="grid gap-4 p-6 xl:grid-cols-2">
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingApprovals.map((approval) => (
              <Link key={approval.id} to={approvalHref(approval.id)} className="block rounded-xl border border-orange-500/20 bg-orange-500/10 p-3">
                <p className="font-bold text-orange-100">{approval.summary}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-orange-300">{relativeTime(approval.createdAt)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0d1118]">
          <CardHeader>
            <CardTitle className="text-zinc-100">Blocked issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openIssues
              .filter((issue) => issue.status === "blocked")
              .map((issue) => (
                <Link key={issue.id} to={issueHref(issue.id)} className="block rounded-xl border border-white/10 bg-[#080c14] p-3">
                  <p className="font-bold text-zinc-100">{issue.identifier ?? issue.title}</p>
                  <p className="mt-2 text-sm text-zinc-400">{issue.title}</p>
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (section === "issues") {
    return (
      <div className="space-y-4 p-6">
        {snapshot.issues.map((issue) => (
          <Link key={issue.id} to={issueHref(issue.id)} className="block rounded-2xl border border-white/10 bg-[#0d1118] p-4 hover:border-blue-500/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-zinc-100">{issue.identifier ?? issue.title}</p>
                <p className="mt-1 text-zinc-400">{issue.title}</p>
              </div>
              <Badge variant="outline" className="border-white/10 bg-black text-zinc-300">
                {issue.status}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (section === "goals") {
    return (
      <div className="space-y-4 p-6">
        {snapshot.goals.map((goal) => (
          <Card key={goal.id} className="border-white/10 bg-[#0d1118]">
            <CardHeader>
              <CardTitle className="text-zinc-100">{goal.title}</CardTitle>
              <CardDescription className="text-zinc-500">{goal.status}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-zinc-300">{goal.summary}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (section === "approvals") {
    return (
      <div className="space-y-4 p-6">
        {snapshot.approvals.map((approval) => (
          <Link key={approval.id} to={approvalHref(approval.id)} className="block rounded-2xl border border-white/10 bg-[#0d1118] p-4 hover:border-orange-500/30">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-zinc-100">{approval.summary}</p>
              <Badge variant="outline" className="border-white/10 bg-black text-zinc-300">
                {approval.status}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    );
  }

  if (section === "projects") {
    return (
      <div className="space-y-4 p-6">
        {snapshot.projects.map((project) => (
          <Link key={project.id} to={projectHref(project.id)} className="block rounded-2xl border border-white/10 bg-[#0d1118] p-4 hover:border-blue-500/30">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-zinc-100">{project.name}</p>
              <Badge variant="outline" className="border-white/10 bg-black text-zinc-300">
                {project.status}
              </Badge>
            </div>
            <p className="mt-2 text-zinc-400">{project.summary}</p>
          </Link>
        ))}
      </div>
    );
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
            <p className="mt-2 text-sm">{snapshot.source === "supabase" ? "Live Supabase tables" : "Demo fallback snapshot"}</p>
          </div>
          <Separator className="bg-white/10" />
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">Message</p>
            <p className="mt-2 text-sm">{snapshot.sourceMessage ?? "Schema is live and the app is reading from Supabase."}</p>
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
/*  Dashboard section — all data queries Supabase directly, scoped    */
/*  to the active company. Every panel has intentional empty states.   */
/*  (VAL-DASH-001, VAL-DASH-002, VAL-DASH-003)                       */
/* ------------------------------------------------------------------ */

function DashboardSection({ snapshot }: { snapshot: AgencySnapshot }) {
  // Metric card aggregates
  const { data: agentMetrics, isLoading: agentMetricsLoading } = useAgentMetrics();
  const { data: issueMetrics, isLoading: issueMetricsLoading } = useIssueMetrics();
  const { data: runMetrics, isLoading: runMetricsLoading } = useRunMetrics();
  const { data: approvalCount, isLoading: approvalMetricsLoading } = useApprovalMetrics();

  // Chart + panel row data — from dedicated Supabase hooks
  const { data: liveRuns = [], isLoading: runsLoading } = useDashboardRuns();
  const { data: liveIssues = [], isLoading: issuesLoading } = useDashboardIssues();
  const { data: liveAgents = [], isLoading: agentsLoading } = useDashboardAgents();
  const { data: liveActivity = [], isLoading: activityLoading } = useDashboardActivity();

  const isDemoMode = snapshot.source !== "supabase";

  // Determine if we're in initial loading of core data
  const metricsLoading = agentMetricsLoading || issueMetricsLoading || runMetricsLoading || approvalMetricsLoading;

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
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid md:grid-cols-2 gap-4">
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
  const { data: company, isLoading: companyLoading } = useCompanySettings();
  const { data: supabaseHealthy } = useSupabaseHealth();
  const onboarding = useOnboardingState(company?.wallet_address ?? null);
  const [showTour, setShowTour] = useState(false);

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

  return (
    <div className="grid gap-4 p-6 xl:grid-cols-2">
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
            <p className="mt-2 text-sm">
              {companyLoading ? "Loading…" : company?.name ?? snapshot.company.name}
            </p>
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
              {snapshot.source === "supabase"
                ? "Live Supabase tables"
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
              onboarding.resetOnboarding();
              toast.success("Onboarding reset. The wizard will appear on next visit.");
            }}
            variant="outline"
            className="border-white/10 text-zinc-200 hover:bg-[#141b27] hover:text-white"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Onboarding
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
