import React, { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAgencyStore, DebugLogEntry } from '../store/agencyStore'
import { getAgentSet } from '../data/agents'
import { supabase } from '@/integrations/supabase/client'
import { useActiveCompany } from '@/hooks/useActiveCompany'
import { ChevronDown, ChevronRight, MessageSquare, Terminal, Eye, Zap, Copy, Check, Download, Filter } from 'lucide-react'

/* ── Supabase activity row shape ── */

interface ActivityRow {
  id: string;
  company_id: string;
  agent_id: string | null;
  issue_id: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

interface AgentLookup {
  id: string;
  name: string;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatIsoTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded transition-all cursor-pointer ${copied ? 'text-emerald-300' : 'text-zinc-500 hover:text-zinc-100 hover:bg-white/10'}`}
      title="Copy to clipboard"
    >
      {copied ? <Check size={10} /> : <Copy size={10} />}
    </button>
  );
};

const DebugEntryView: React.FC<{ entry: DebugLogEntry }> = ({ entry }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedAgentSetId = useAgencyStore((s) => s.selectedAgentSetId);
    const agents = getAgentSet(selectedAgentSetId).agents;
    const agent = agents.find(a => a.index === entry.agentIndex);

    // Parse tool calls from rawContent (only available in response entries)
    let toolCalls: any[] = [];
    let parsedResponse: any = null;
    if (entry.phase === 'response') {
        try {
            parsedResponse = JSON.parse(entry.rawContent);
            if (Array.isArray(parsedResponse.toolCalls)) {
                toolCalls = parsedResponse.toolCalls;
            }
        } catch (e) {
            // rawContent is not valid JSON
        }
    }

    const fullContent = `
AGENT: ${agent?.role} (${entry.phase})
TIME: ${formatTime(entry.timestamp)}
PHASE: ${entry.phase}

SYSTEM PROMPT:
${entry.systemPrompt}

DYNAMIC CONTEXT:
${entry.dynamicContext}

${entry.phase === 'request' ? 'REQUEST MESSAGE' : 'RAW RESPONSE'}:
${entry.rawContent}
    `.trim();

    return (
        <div className="group border-b border-white/6 last:border-0 py-3">
            <div className="flex items-center gap-1 mb-1 pr-1">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center justify-between rounded p-1 text-left transition-colors cursor-pointer hover:bg-white/5"
                >
                    <div className="flex flex-col gap-1.5 w-full">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent?.color ?? '#ccc' }} />
                                <span className="text-[10px] font-black text-zinc-100 uppercase tracking-widest leading-none">
                                    {agent?.role}
                                </span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                                    entry.phase === 'request' ? 'bg-blue-500/12 text-blue-200' : 'bg-emerald-500/12 text-emerald-200'
                                }`}>
                                    {entry.phase}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[8px] font-mono text-zinc-500">{formatTime(entry.timestamp)}</span>
                                {isOpen ? <ChevronDown size={12} className="text-zinc-500" /> : <ChevronRight size={12} className="text-zinc-500" />}
                            </div>
                        </div>

                        {/* Summary of tool calls in preview */}
                        {toolCalls.length > 0 && !isOpen && (
                            <div className="flex flex-wrap gap-1 pl-4">
                                {toolCalls.map((tc, i) => (
                                    <span key={i} className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-200 shadow-sm">
                                        <Zap size={8} />
                                        {tc.function?.name ?? tc.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </button>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton text={fullContent} />
                </div>
            </div>

            {isOpen && (
                <div className="mt-2 space-y-2 border-l border-white/10 pl-4">
                    {/* System Prompt — collapsed by default */}
                    <details className="group/sp">
                        <summary className="flex items-center justify-between gap-1.5 py-1 cursor-pointer list-none">
                            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                                <ChevronRight size={10} className="text-zinc-500 group-open/sp:rotate-90 transition-transform" />
                                <Terminal size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">System Prompt</span>
                            </div>
                            <div onClick={e => e.stopPropagation()}>
                                <CopyButton text={entry.systemPrompt} />
                            </div>
                        </summary>
                        <pre className="mt-1.5 rounded border border-white/10 bg-[#0f141d] p-2 text-[10px] font-mono leading-relaxed text-zinc-300 whitespace-pre-wrap">
                            {entry.systemPrompt}
                        </pre>
                    </details>

                    {/* Dynamic Context — collapsed by default */}
                    <details className="group/dc">
                        <summary className="flex items-center justify-between gap-1.5 py-1 cursor-pointer list-none">
                            <div className="flex items-center gap-1.5 opacity-50 hover:opacity-100 transition-opacity">
                                <ChevronRight size={10} className="text-zinc-500 group-open/dc:rotate-90 transition-transform" />
                                <Zap size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Dynamic Context</span>
                            </div>
                            <div onClick={e => e.stopPropagation()}>
                                <CopyButton text={entry.dynamicContext} />
                            </div>
                        </summary>
                        <pre className="mt-1.5 rounded border border-amber-500/20 bg-amber-500/10 p-2 text-[10px] font-mono leading-relaxed text-amber-100 whitespace-pre-wrap">
                            {entry.dynamicContext}
                        </pre>
                    </details>

                    <div className="pt-2">
                        <div className="flex items-center justify-between gap-1.5 mb-1.5 opacity-50">
                            <div className="flex items-center gap-1.5">
                                <MessageSquare size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                                    {entry.phase === 'request' ? 'Request Message' : 'Response Details'}
                                </span>
                            </div>
                            <CopyButton text={entry.rawContent} />
                        </div>
                        {entry.phase === 'response' ? (
                            <div className="space-y-3">
                                {parsedResponse ? (
                                    <>
                                        {/* Formatted Text Content */}
                                        {parsedResponse.text && (
                                            <div className="relative rounded border border-white/10 bg-[#0f141d] p-3 text-[11px] italic leading-relaxed text-zinc-200 shadow-sm whitespace-pre-wrap">
                                                <div className="absolute -top-2 left-2 rounded border border-white/10 bg-[#111724] px-1 text-[8px] font-black uppercase text-zinc-500">Text</div>
                                                {parsedResponse.text}
                                            </div>
                                        )}

                                        {/* Formatted Tool Calls */}
                                        {toolCalls.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-1.5 ml-1">
                                                    <Zap size={10} className="text-emerald-500" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Tool calls</span>
                                                </div>
                                                {toolCalls.map((tc, i) => {
                                                    const name = tc.function?.name ?? tc.name ?? '(unknown)';
                                                    let args: Record<string, unknown> | null = null;
                                                    try { args = JSON.parse(tc.function?.arguments ?? '{}'); } catch { args = tc.args ?? null; }
                                                    return (
                                                        <div key={i} className="bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 shadow-lg">
                                                            <div className="bg-zinc-800 px-2.5 py-1.5 flex items-center justify-between">
                                                                <span className="text-[10px] font-black text-emerald-400 font-mono tracking-wider">{name}</span>
                                                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">Arguments</span>
                                                            </div>
                                                            <div className="p-2.5 bg-zinc-900/50">
                                                                {args && Object.keys(args).length > 0 ? (
                                                                    <div className="space-y-1.5">
                                                                        {Object.entries(args).map(([key, value]) => (
                                                                            <div key={key} className="flex flex-col gap-0.5">
                                                                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-tighter">{key}</span>
                                                                                <div className="text-[9px] text-zinc-300 font-mono bg-zinc-800/50 p-1.5 rounded border border-zinc-700/50 wrap-break-word whitespace-pre-wrap">
                                                                                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[9px] text-zinc-500 italic">No arguments</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Raw JSON fallback */}
                                        <details className="mt-2">
                                            <summary className="ml-1 cursor-pointer text-[8px] font-bold uppercase text-zinc-500 transition-colors hover:text-zinc-300">View Full Raw JSON</summary>
                                            <pre className="mt-1 overflow-x-auto whitespace-pre rounded border border-white/10 bg-[#0f141d] p-2 text-[9px] font-mono text-zinc-400">
                                                {entry.rawContent}
                                            </pre>
                                        </details>
                                    </>
                                ) : (
                                    <pre className="rounded border border-white/10 bg-[#0f141d] p-2 text-[10px] font-mono leading-relaxed text-zinc-300 shadow-sm whitespace-pre-wrap">
                                        {entry.rawContent}
                                    </pre>
                                )}
                            </div>
                        ) : (
                            <pre className="rounded border border-white/10 bg-[#0f141d] p-2 text-[10px] font-mono leading-relaxed text-zinc-300 shadow-sm whitespace-pre-wrap">
                                {entry.rawContent}
                            </pre>
                        )}
                    </div>

                    {entry.messages.length > 1 && (
                        <div>
                             <div className="flex items-center gap-1.5 mb-1.5 opacity-50">
                                <Eye size={10} />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">History Snapshot ({entry.messages.length} msgs)</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {entry.messages.map((m, i) => (
                                    <div key={i} className={`p-1.5 rounded text-[9px] ${m.role === 'user' ? 'bg-[#0f141d] border border-white/10' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                                        <div className="font-bold uppercase tracking-tighter mb-0.5 opacity-40">{m.role}</div>
                                        <div className="line-clamp-3 hover:line-clamp-none transition-all">{typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* ── Live Activity Feed (Supabase-backed) ── */

function useLiveActivity(companyId: string | null, filterAgentId: string | null) {
  return useQuery<ActivityRow[]>({
    queryKey: ["cockpit-live-activity", companyId, filterAgentId],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from("activity_events")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (filterAgentId) {
        query = query.eq("agent_id", filterAgentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
    enabled: !!companyId,
    refetchInterval: 15_000,
  });
}

function useLiveAgents(companyId: string | null) {
  return useQuery<AgentLookup[]>({
    queryKey: ["cockpit-live-agents", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("agents")
        .select("id, name")
        .eq("company_id", companyId);

      if (error) throw error;
      return (data ?? []) as AgentLookup[];
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function ActionLogPanel() {
  const { setLogOpen, actionLog, debugLog, logFilterAgentIndex, phase, setFinalOutputOpen, selectedAgentSetId } = useAgencyStore()
  const runtimeAgents = getAgentSet(selectedAgentSetId).agents;
  const [activeTab, setActiveTab] = useState<'activity' | 'technical'>('activity')
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [activityFilterAgentId, setActivityFilterAgentId] = useState<string | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const { companyId } = useActiveCompany();
  const { data: liveActivity = [] } = useLiveActivity(companyId, activityFilterAgentId);
  const { data: liveAgents = [] } = useLiveAgents(companyId);

  const agentNameMap = React.useMemo(
    () => new Map(liveAgents.map((a) => [a.id, a.name])),
    [liveAgents],
  );

  const handleDownloadAll = () => {
    const content = debugLog.map(entry => {
      const agent = runtimeAgents.find(a => a.index === entry.agentIndex);
      return `
=========================================
AGENT: ${agent?.role} (${entry.phase})
TIME: ${new Date(entry.timestamp).toLocaleString()}
PHASE: ${entry.phase}
=========================================

SYSTEM PROMPT:
${entry.systemPrompt}

-----------------------------------------
DYNAMIC CONTEXT:
${entry.dynamicContext}

-----------------------------------------
${entry.phase === 'request' ? 'REQUEST MESSAGE' : 'RAW RESPONSE'}:
${entry.rawContent}

`.trim();
    }).join('\n\n\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agency-cockpit-technical-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-scroll to top when a new log entry arrives (since order is reversed)
  useEffect(() => {
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [liveActivity, actionLog, debugLog, activeTab])

  /* ── Filters for the runtime-local Technical tab ── */

  const filterAgent =
    logFilterAgentIndex !== null ? runtimeAgents.find(a => a.index === logFilterAgentIndex) ?? null : null

  const entries =
    logFilterAgentIndex !== null
      ? actionLog.filter((e) => e.agentIndex === logFilterAgentIndex).reverse()
      : [...actionLog].reverse()

  const debugEntries =
    logFilterAgentIndex !== null
      ? debugLog.filter((e) => e.agentIndex === logFilterAgentIndex).reverse()
      : [...debugLog].reverse()

  /* ── Agent filter handler — works for both tabs ── */

  function handleAgentFilter(agentId: string | null) {
    setActivityFilterAgentId(agentId);
    setIsFilterMenuOpen(false);

    // Also update the runtime agent filter for the technical tab
    if (agentId === null) {
      setLogOpen(true, null);
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden border-r border-white/10 glass-panel pointer-events-auto">
          {/* Header */}
          <div className="z-10 flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#0c1017] px-5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Logs</span>
              {activeTab === 'activity' && activityFilterAgentId && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-blue-500 uppercase tracking-tighter animate-in fade-in zoom-in duration-200"
                >
                  {agentNameMap.get(activityFilterAgentId) ?? 'Agent'}
                  <button
                    onClick={() => handleAgentFilter(null)}
                    className="hover:scale-110 transition-transform cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}
              {activeTab === 'technical' && filterAgent && (
                <div
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase tracking-tighter animate-in fade-in zoom-in duration-200"
                  style={{ backgroundColor: filterAgent.color }}
                >
                  {filterAgent.role}
                  <button
                    onClick={() => setLogOpen(true, null)}
                    className="hover:scale-110 transition-transform cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    isFilterMenuOpen || activityFilterAgentId !== null || logFilterAgentIndex !== null
                      ? 'bg-zinc-100 text-black'
                      : 'text-zinc-500 hover:text-zinc-100 hover:bg-white/5'
                  }`}
                  title="Filter by agent"
                >
                  <Filter size={14} />
                </button>

                {isFilterMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setIsFilterMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-30 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#0f141d] py-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                      <button
                        onClick={() => {
                          handleAgentFilter(null);
                          setLogOpen(true, null);
                        }}
                        className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 transition-colors ${
                          activityFilterAgentId === null && logFilterAgentIndex === null ? 'text-zinc-100' : 'text-zinc-500'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${activityFilterAgentId === null && logFilterAgentIndex === null ? 'bg-zinc-100' : 'bg-transparent border border-white/15'}`} />
                        All Agents
                      </button>
                      <div className="my-1 h-px bg-white/10" />

                      {/* Live agent entries for Activity tab filtering */}
                      {activeTab === 'activity' && liveAgents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => handleAgentFilter(agent.id)}
                          className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 transition-colors ${
                            activityFilterAgentId === agent.id ? 'text-zinc-100' : 'text-zinc-500'
                          }`}
                        >
                          <div className="w-2 h-2 rounded-full bg-blue-400" />
                          {agent.name}
                        </button>
                      ))}

                      {/* Runtime agent entries for Technical tab filtering */}
                      {activeTab === 'technical' && runtimeAgents.map((agent) => (
                        <button
                          key={agent.index}
                          onClick={() => {
                            setLogOpen(true, agent.index);
                            setIsFilterMenuOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 transition-colors ${
                            logFilterAgentIndex === agent.index ? 'text-zinc-100' : 'text-zinc-500'
                          }`}
                        >
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: agent.color }}
                          />
                          {agent.role}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {activeTab === 'technical' && debugEntries.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="rounded p-1 text-zinc-500 transition-colors cursor-pointer hover:bg-white/5 hover:text-zinc-100"
                  title="Download all as .txt"
                >
                  <Download size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-white/10 bg-[#090d15]">
            <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    activeTab === 'activity' ? 'bg-[#070a11] border-b-2 border-zinc-100 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
                Activity
            </button>
            <button
                onClick={() => setActiveTab('technical')}
                className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    activeTab === 'technical' ? 'bg-[#070a11] border-b-2 border-zinc-100 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
            >
                Technical
            </button>
          </div>

          {/* Entries */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#05070c] p-5 shadow-[inset_0_-20px_20px_-20px_rgba(0,0,0,0.24)]">
            <div ref={topRef} />

            {activeTab === 'activity' ? (
              /* ── Live Supabase activity feed ── */
              liveActivity.length === 0 ? (
                <p className="py-16 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">No activity yet...</p>
              ) : (
                liveActivity.map((event) => {
                  const agentName = event.agent_id ? agentNameMap.get(event.agent_id) ?? 'Agent' : 'System';
                  return (
                    <div key={event.id} className="flex flex-col gap-1.5 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full shadow-sm bg-blue-400"
                          />
                          <span className="text-[10px] font-black text-zinc-100 uppercase tracking-widest leading-none">
                            {agentName}
                          </span>
                        </div>
                        <span className="text-[9px] font-medium text-zinc-500 font-mono">
                          {formatIsoTime(event.created_at)}
                        </span>
                      </div>

                      <div className="pl-3.5 border-l border-white/8 group-hover:border-white/16 transition-colors">
                        <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                          {event.details ?? event.action.replace(/[._]/g, ' ')}
                        </p>
                        <p className="text-[9px] text-zinc-500 mt-0.5">
                          {event.action}
                        </p>
                      </div>
                    </div>
                  )
                })
              )
            ) : (
                /* ── Technical tab (runtime debug log, unchanged) ── */
                debugEntries.length === 0 ? (
                    <p className="py-16 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-600">No technical data...</p>
                ) : (
                    debugEntries.map((entry) => (
                        <DebugEntryView key={entry.id} entry={entry} />
                    ))
                )
            )}
          </div>
    </div>
  )
}
