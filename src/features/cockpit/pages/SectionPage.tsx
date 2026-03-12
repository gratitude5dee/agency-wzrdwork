import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAgencyData } from "../lib/useAgencyData";
import { formatUsd, projectHref, relativeTime, issueHref, approvalHref, agentHref, runHref } from "../lib/format";

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

function MetricCard({ title, value, tone = "default" }: { title: string; value: string | number; tone?: Parameters<typeof toneClass>[0] }) {
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
    return (
      <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Agents" value={snapshot.agents.length} tone="info" />
        <MetricCard title="Open issues" value={openIssues.length} />
        <MetricCard title="Live runs" value={liveRuns.length} tone="info" />
        <MetricCard title="Approvals" value={pendingApprovals.length} tone={pendingApprovals.length ? "warning" : "default"} />
        <Card className="border-white/10 bg-[#0d1118] md:col-span-2 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-zinc-100">Urgent issues</CardTitle>
            <CardDescription className="text-zinc-500">The cockpit’s most time-sensitive work items.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openIssues.slice(0, 5).map((issue) => (
              <Link key={issue.id} to={issueHref(issue.id)} className="block rounded-xl border border-white/10 bg-[#080c14] p-3 hover:border-blue-500/30">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-zinc-100">{issue.identifier ?? issue.title}</p>
                  <Badge variant="outline" className="border-white/10 bg-black text-zinc-400">
                    {issue.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{issue.title}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[#0d1118] md:col-span-2 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-zinc-100">Recent activity</CardTitle>
            <CardDescription className="text-zinc-500">Latest events from the company timeline.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.activity.slice(0, 6).map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/10 bg-[#080c14] p-3">
                <p className="font-bold text-zinc-100">{entry.action.replace(/[._]/g, " ")}</p>
                <p className="mt-1 text-sm text-zinc-400">{entry.details}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.22em] text-zinc-600">{relativeTime(entry.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
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
        <MetricCard title="Total runtime cost" value={formatUsd(totalCost)} tone="info" />
        <MetricCard title="Total runs" value={snapshot.runs.length} />
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
