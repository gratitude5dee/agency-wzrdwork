import React from 'react';
import { useAgencyStore } from '../store/agencyStore';
import { getAgentSet } from '../data/agents';
import type {
  AgentInspectorApproval,
  AgentInspectorLatestRun,
  InspectorItem,
  InspectorLink,
  InspectorStat,
  InspectorTone,
} from '../store/inspector';

function toneClasses(tone: InspectorTone | undefined): string {
  switch (tone) {
    case 'info':
      return 'bg-blue-500/12 text-blue-200 border-blue-500/25';
    case 'success':
      return 'bg-emerald-500/12 text-emerald-200 border-emerald-500/25';
    case 'warning':
      return 'bg-orange-500/12 text-orange-200 border-orange-500/25';
    case 'danger':
      return 'bg-red-500/12 text-red-200 border-red-500/25';
    case 'muted':
      return 'bg-[#080b12] text-zinc-400 border-white/10';
    default:
      return 'bg-[#0d1118] text-zinc-200 border-white/10';
  }
}

function LinkPill({ link }: { link: InspectorLink }) {
  return (
    <a
      href={link.href}
      className="rounded-full border border-white/10 bg-[#0d1118] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition-colors hover:border-blue-500/30 hover:bg-[#121824] hover:text-zinc-100"
    >
      {link.label}
    </a>
  );
}

function DetailCard({ title, subtitle, meta, tone }: InspectorItem) {
  return (
    <div className={`rounded-xl border p-3 ${toneClasses(tone)}`}>
      <p className="text-[12px] font-black leading-tight text-zinc-50">{title}</p>
      {subtitle && (
        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-75">
          {subtitle}
        </p>
      )}
      {meta && (
        <p className="mt-2 text-[11px] leading-relaxed opacity-80">{meta}</p>
      )}
    </div>
  );
}

function RunCard({ run }: { run: AgentInspectorLatestRun }) {
  return (
    <div className={`rounded-xl border p-3 ${toneClasses(run.statusTone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{run.label}</p>
          <p className="mt-1 text-[12px] font-black leading-tight text-zinc-50">{run.statusLabel}</p>
        </div>
        {run.isLive && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
            Live
          </span>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-200">{run.summary}</p>
      {(run.meta || run.error) && (
        <p className="mt-2 text-[10px] leading-relaxed opacity-80">
          {run.meta}
          {run.meta && run.error ? ' | ' : ''}
          {run.error}
        </p>
      )}
      {run.href && (
        <a
          href={run.href}
          className="mt-3 inline-flex rounded-full border border-white/10 bg-[#111724] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition-colors hover:border-blue-500/30 hover:bg-[#161d2c] hover:text-zinc-100"
        >
          Open run
        </a>
      )}
    </div>
  );
}

function ApprovalCard({ approval }: { approval: AgentInspectorApproval }) {
  return (
    <div className={`rounded-xl border p-3 ${toneClasses(approval.tone)}`}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{approval.label}</p>
      <p className="mt-1 text-[12px] font-black leading-tight text-zinc-50">{approval.statusLabel}</p>
      {approval.meta && (
        <p className="mt-2 text-[11px] leading-relaxed opacity-80">{approval.meta}</p>
      )}
      {approval.href && (
        <a
          href={approval.href}
          className="mt-3 inline-flex rounded-full border border-white/10 bg-[#111724] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition-colors hover:border-orange-500/30 hover:bg-[#161d2c] hover:text-zinc-100"
        >
          Open approval
        </a>
      )}
    </div>
  );
}

function StatCard({ stat }: { stat: InspectorStat }) {
  return (
    <div className={`rounded-xl border p-3 ${toneClasses(stat.tone)}`}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{stat.label}</p>
      <p className="mt-1 text-sm font-black leading-none">{stat.value}</p>
    </div>
  );
}

interface AgentViewProps {
  agentIndex: number;
}

const AgentView: React.FC<AgentViewProps> = ({ agentIndex }) => {
  const { tasks, selectedAgentSetId, agentInspectors } = useAgencyStore();
  const agents = getAgentSet(selectedAgentSetId).agents;

  const agent = agents.find(a => a.index === agentIndex);
  if (!agent) return null;
  const inspector = agentInspectors[agentIndex] ?? null;

  const activeTask = tasks.find(
    (t) => t.assignedAgentIds.includes(agentIndex) && (t.status === 'in_progress' || t.status === 'in_review')
  ) ?? null;

  return (
    <div className="flex h-full flex-col bg-[#070a11] p-6 text-zinc-200">
      {inspector && (
        <>
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${toneClasses(inspector.statusTone)}`}>
                {inspector.statusLabel}
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${toneClasses(inspector.visualStateTone)}`}>
                {inspector.visualStateLabel}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                {inspector.adapterLabel}
              </span>
            </div>
            <p className="text-xs font-bold text-zinc-100">{inspector.agentName}</p>
            {inspector.manager && (
              <a href={inspector.manager.href} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-100">
                Reports to {inspector.manager.label}
              </a>
            )}
          </div>

          {inspector.activeIssue && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Active Issue
              </p>
              {inspector.activeIssue.href ? (
                <a href={inspector.activeIssue.href} className="block">
                  <DetailCard {...inspector.activeIssue} />
                </a>
              ) : (
                <DetailCard {...inspector.activeIssue} />
              )}
            </div>
          )}

          {inspector.pendingApproval && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Approval
              </p>
              <ApprovalCard approval={inspector.pendingApproval} />
            </div>
          )}

          {inspector.latestRun && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Runtime
              </p>
              <RunCard run={inspector.latestRun} />
            </div>
          )}

          {(inspector.lastHeartbeat || inspector.session || inspector.lastError) && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Health
              </p>
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#0d1118] p-4">
                {inspector.lastHeartbeat && (
                  <p className="text-[11px] text-zinc-300">
                    <span className="mr-2 font-black uppercase tracking-widest text-zinc-500">Heartbeat</span>
                    {inspector.lastHeartbeat}
                  </p>
                )}
                {inspector.session && (
                  <p className="text-[11px] text-zinc-300">
                    <span className="mr-2 font-black uppercase tracking-widest text-zinc-500">Session</span>
                    {inspector.session}
                  </p>
                )}
                {inspector.lastError && (
                  <p className="text-[11px] text-red-600 leading-relaxed">
                    <span className="mr-2 font-black uppercase tracking-widest text-red-300">Error</span>
                    {inspector.lastError}
                  </p>
                )}
              </div>
            </div>
          )}

          {(inspector.tokenStats.length > 0 || inspector.totalCost || inspector.budget) && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Usage
              </p>
              <div className="grid grid-cols-2 gap-2">
                {inspector.budget && <StatCard stat={inspector.budget} />}
                {inspector.tokenStats.map((stat) => (
                  <StatCard key={stat.label} stat={stat} />
                ))}
                {inspector.totalCost && (
                  <StatCard stat={{ label: 'Cost', value: inspector.totalCost, tone: 'muted' }} />
                )}
              </div>
            </div>
          )}

          {inspector.heartbeatItems.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Heartbeats
              </p>
              <div className="space-y-2">
                {inspector.heartbeatItems.map((item) => (
                  item.href ? (
                    <a key={`${item.title}-${item.meta ?? ''}`} href={item.href} className="block">
                      <DetailCard {...item} />
                    </a>
                  ) : (
                    <DetailCard key={`${item.title}-${item.meta ?? ''}`} {...item} />
                  )
                ))}
              </div>
            </div>
          )}

          {inspector.workProducts.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Work Products
              </p>
              <div className="space-y-2">
                {inspector.workProducts.map((item) => (
                  item.href ? (
                    <a key={`${item.title}-${item.meta ?? ''}`} href={item.href} className="block">
                      <DetailCard {...item} />
                    </a>
                  ) : (
                    <DetailCard key={`${item.title}-${item.meta ?? ''}`} {...item} />
                  )
                ))}
              </div>
            </div>
          )}

          {inspector.governanceItems.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Governance
              </p>
              <div className="space-y-2">
                {inspector.governanceItems.map((item) => (
                  item.href ? (
                    <a key={`${item.title}-${item.meta ?? ''}`} href={item.href} className="block">
                      <DetailCard {...item} />
                    </a>
                  ) : (
                    <DetailCard key={`${item.title}-${item.meta ?? ''}`} {...item} />
                  )
                ))}
              </div>
            </div>
          )}

          {(inspector.documents.length > 0 || inspector.workspaceItems.length > 0 || inspector.environmentItems.length > 0 || inspector.runtimeServices.length > 0) && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Assets & Workspace
              </p>
              <div className="space-y-2">
                {[...inspector.documents, ...inspector.workspaceItems, ...inspector.environmentItems, ...inspector.runtimeServices].map((item) => (
                  item.href ? (
                    <a key={`${item.title}-${item.meta ?? ''}`} href={item.href} className="block">
                      <DetailCard {...item} />
                    </a>
                  ) : (
                    <DetailCard key={`${item.title}-${item.meta ?? ''}`} {...item} />
                  )
                ))}
              </div>
            </div>
          )}

          {(inspector.routineItems.length > 0 || inspector.pluginResourceItems.length > 0 || inspector.secretItems.length > 0) && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Controls
              </p>
              <div className="space-y-2">
                {[...inspector.routineItems, ...inspector.pluginResourceItems, ...inspector.secretItems].map((item) => (
                  item.href ? (
                    <a key={`${item.title}-${item.meta ?? ''}`} href={item.href} className="block">
                      <DetailCard {...item} />
                    </a>
                  ) : (
                    <DetailCard key={`${item.title}-${item.meta ?? ''}`} {...item} />
                  )
                ))}
              </div>
            </div>
          )}

          {inspector.recentIssues.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Recent Issues
              </p>
              <div className="space-y-2">
                {inspector.recentIssues.map((item) => (
                  item.href ? (
                    <a key={`${item.title}-${item.meta ?? ''}`} href={item.href} className="block">
                      <DetailCard {...item} />
                    </a>
                  ) : (
                    <DetailCard key={`${item.title}-${item.meta ?? ''}`} {...item} />
                  )
                ))}
              </div>
            </div>
          )}

          {inspector.links.length > 0 && (
            <div className="mb-2">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Open Detail
              </p>
              <div className="flex flex-wrap gap-2">
                {inspector.links.map((link) => (
                  <LinkPill key={link.href} link={link} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!inspector && (
        <>
      {/* Expertise / Traits */}
          <div className="mb-6">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Expertise</p>
            <p className="text-xs italic leading-relaxed text-zinc-300">{agent.mission}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {agent.expertise.map(exp => (
                <span key={exp} className="rounded-full border border-white/10 bg-[#0f141d] px-2 py-0.5 text-[9px] font-bold uppercase text-zinc-400">
                  {exp}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-6 h-px w-full bg-white/10" />

          {/* Task Status */}
          {activeTask ? (
            <div className="mb-6">
              <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: agent.color }}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: agent.color }}></span>
                </span>
                Doing Now
              </p>
              <p className="text-sm font-bold leading-snug text-zinc-100">
                "{activeTask.description}"
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500/70">
                Status
              </p>
              <p className="text-sm font-medium italic leading-snug text-zinc-500">
                Waiting for next task...
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AgentView;
