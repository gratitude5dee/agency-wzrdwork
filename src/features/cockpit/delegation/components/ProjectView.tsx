import React from 'react';
import { useAgencyStore } from '../store/agencyStore';
import { ScrollText, ArrowUpRight } from 'lucide-react';
import type { InspectorItem, InspectorTone, InspectorLink, InspectorStat } from '../store/inspector';

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

function StatCard({ stat }: { stat: InspectorStat }) {
  return (
    <div className={`rounded-xl border p-3 ${toneClasses(stat.tone)}`}>
      <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{stat.label}</p>
      <p className="mt-1 text-lg font-black leading-none">{stat.value}</p>
    </div>
  );
}

function IssueCard({ item }: { item: InspectorItem }) {
  const body = (
    <div className={`rounded-xl border p-3 transition-colors ${toneClasses(item.tone)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-black leading-tight text-zinc-50">{item.title}</p>
          {item.subtitle && (
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-70">
              {item.subtitle}
            </p>
          )}
        </div>
        {item.href && <ArrowUpRight size={12} className="shrink-0 opacity-60" />}
      </div>
      {item.meta && (
        <p className="mt-2 text-[11px] leading-relaxed opacity-80">{item.meta}</p>
      )}
    </div>
  );

  if (!item.href) return body;

  return (
    <a href={item.href} className="block">
      {body}
    </a>
  );
}

function QuickLink({ link }: { link: InspectorLink }) {
  return (
    <a
      href={link.href}
      className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0d1118] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-zinc-300 transition-colors hover:border-blue-500/30 hover:bg-[#121824] hover:text-zinc-100"
    >
      <span>{link.label}</span>
      <ArrowUpRight size={12} className="text-zinc-500" />
    </a>
  );
}

const ProjectView: React.FC = () => {
  const {
    clientBrief,
    phase,
    projectInspector,
  } = useAgencyStore();

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#070a11] p-6 text-zinc-200">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-black leading-tight text-zinc-50">Project Info</h2>
          <div className="flex items-center gap-2">
            <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
              phase === 'working' ? 'bg-blue-500 text-white' :
              phase === 'done' ? 'bg-green-500 text-white' :
              phase === 'briefing' ? 'bg-amber-500 text-white' :
              'bg-white/10 text-zinc-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${['working', 'briefing'].includes(phase) ? 'bg-white animate-pulse' : 'bg-white opacity-40'}`} />
              {phase}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 h-px w-full bg-white/10" />

      {/* Brief */}
      <div className="mb-8">
        <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
          <ScrollText size={10} />
          Company Brief
        </p>
        <div className="rounded-xl border border-white/10 bg-[#0d1118] p-4">
          <p className="text-xs font-medium italic leading-relaxed text-zinc-300">
            {clientBrief || "No company brief is available yet. Use the New Issue flow to create work."}
          </p>
        </div>
      </div>

      {projectInspector && (
        <>
          <div className="mb-8">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Company
            </p>
            <div className="rounded-xl border border-white/10 bg-[#0d1118] p-4 shadow-sm">
              <p className="text-sm font-black text-zinc-50">{projectInspector.companyName}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {projectInspector.companyType}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-zinc-300">
                {projectInspector.companyDescription}
              </p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Live Summary
            </p>
            <div className="grid grid-cols-2 gap-2">
              {projectInspector.stats.map((stat) => (
                <StatCard key={stat.label} stat={stat} />
              ))}
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Urgent Issues
              </p>
              {projectInspector.urgentIssues.length > 0 && (
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  Top {projectInspector.urgentIssues.length}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {projectInspector.urgentIssues.length > 0 ? (
                projectInspector.urgentIssues.map((item) => (
                  <IssueCard key={`${item.title}-${item.meta ?? ''}`} item={item} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-[#0b0f16] p-4 text-[11px] font-medium text-zinc-500">
                  No urgent issues right now.
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Quick Links
            </p>
            <div className="grid grid-cols-2 gap-2">
              {projectInspector.links.map((link) => (
                <QuickLink key={link.href} link={link} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectView;
