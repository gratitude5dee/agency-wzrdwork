import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { History, LayoutPanelTop, Network, ShieldCheck, Sparkles, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { ActionLogPanel } from "../delegation/components/ActionLogPanel";
import InspectorPanel from "../delegation/components/InspectorPanel";
import { KanbanPanel } from "../delegation/components/KanbanPanel";
import UIOverlay from "../delegation/components/UIOverlay";
import { setRuntimeAgentSet } from "../delegation/data/agents";
import { useAgencyStore } from "../delegation/store/agencyStore";
import { useStore } from "../delegation/store/useStore";
import { SceneContext } from "../delegation/three/SceneContext";
import { SceneManager, type SceneLifecycleStatus } from "../delegation/three/SceneManager";
import {
  CockpitSceneOverlay,
  isCompactCockpitViewport,
  type CockpitSceneStatus,
} from "../components/CockpitSceneOverlay";
import { buildCockpitRuntime } from "../lib/mappers";
import { useAgencyData } from "../lib/useAgencyData";

export function CockpitPage() {
  const navigate = useNavigate();
  const { snapshot } = useAgencyData();
  const runtime = useMemo(() => buildCockpitRuntime(snapshot), [snapshot]);
  const { isLogOpen, setLogOpen, setRuntimeData, isKanbanOpen } = useAgencyStore();
  const { selectedNpcIndex } = useStore();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const [sceneStatus, setSceneStatus] = useState<CockpitSceneStatus>("loading");
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [compact, setCompact] = useState(() =>
    typeof window === "undefined" ? false : isCompactCockpitViewport(window.innerWidth),
  );

  useEffect(() => {
    setRuntimeAgentSet(runtime.agentSet);
    useAgencyStore.getState().setAgentSet(runtime.agentSet.id);
    setRuntimeData({
      clientBrief: snapshot.company.brief,
      phase: runtime.phase,
      tasks: runtime.tasks,
      actionLog: runtime.actionLog,
      debugLog: runtime.debugLog,
      projectInspector: runtime.projectInspector,
      agentInspectors: runtime.agentInspectors,
      selectedAgentSetId: runtime.agentSet.id,
    });
    // Keep scene instance count in sync with live agent population.
    // The useStore subscription on selectedAgentSetId won't fire when the ID
    // stays constant (always RUNTIME_AGENT_SET_ID), so we explicitly push
    // the count whenever the agent set refreshes.
    useStore.getState().setInstanceCount(runtime.agentSet.agents.length);
  }, [runtime, setRuntimeData, snapshot.company.brief]);

  useEffect(() => {
    const syncViewport = () => setCompact(isCompactCockpitViewport(window.innerWidth));
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    if (compact && isLogOpen) {
      setLogOpen(false);
    }
  }, [compact, isLogOpen, setLogOpen]);

  useEffect(() => {
    const container = canvasRef.current;
    if (!container || sceneManagerRef.current) return;

    const scene = new SceneManager(container, {
      onStatusChange: (status: SceneLifecycleStatus, errorMessage?: string | null) => {
        setSceneStatus(status);
        setSceneError(errorMessage ?? null);
      },
    });

    sceneManagerRef.current = scene;

    return () => {
      scene.dispose();
      sceneManagerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.resetScene();
  }, [runtime.agentSet.agents.length, runtime.phase]);

  const liveRunCount = snapshot.runs.filter(
    (run) => run.status === "running" || run.status === "queued",
  ).length;
  const pendingApprovals = snapshot.approvals.filter((approval) => approval.status === "pending").length;
  const openIssues = snapshot.issues.filter(
    (issue) => issue.status !== "done" && issue.status !== "cancelled",
  ).length;

  return (
    <SceneContext.Provider value={sceneManagerRef.current}>
      <div className="flex h-full flex-col bg-[#05070c] text-zinc-100 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 glass-panel px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
              Delegation sandbox
            </p>
            <h2 className="mt-0.5 text-lg font-black truncate">{snapshot.company.name}</h2>
          </div>

          <div className="hidden sm:flex flex-wrap items-center gap-1.5 shrink-0 ml-4">
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300 text-[10px] px-1.5 py-0">
              {snapshot.agents.length} agents
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300 text-[10px] px-1.5 py-0">
              {liveRunCount} live
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-orange-300 text-[10px] px-1.5 py-0">
              {pendingApprovals} approvals
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300 text-[10px] px-1.5 py-0">
              {openIssues} tasks
            </Badge>
            {snapshot.source !== "supabase" && (
              <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-200 text-[10px] px-1.5 py-0">
                demo
              </Badge>
            )}
          </div>
          {/* Mobile: compact badges */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0 ml-2">
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300 text-[10px] px-1.5 py-0">
              {snapshot.agents.length}A
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300 text-[10px] px-1.5 py-0">
              {liveRunCount}R
            </Badge>
            {snapshot.source !== "supabase" && (
              <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-200 text-[10px] px-1.5 py-0">
                demo
              </Badge>
            )}
          </div>
        </div>

        {/* Demo mode banner — visible when not reading from live Supabase data */}
        {snapshot.source !== "supabase" && (
          <div className="px-4 pt-2">
            <DemoModeBanner message={snapshot.sourceMessage} />
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-white/10 glass-header px-4 py-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4 text-blue-300" />
            <span className="hidden sm:inline text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
              Autonomous company
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 sm:gap-2 border border-white/10 bg-[#0d1118] text-zinc-300 hover:bg-[#141b27] hover:text-white px-2 sm:px-3"
              onClick={() => navigate("/org-chart")}
              data-testid="cockpit-org-chart-link"
            >
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Org Chart</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1 sm:gap-2 border border-white/10 bg-[#0d1118] text-zinc-300 hover:bg-[#141b27] hover:text-white px-2 sm:px-3",
                isLogOpen && !compact ? "border-blue-500/30 text-blue-200" : "",
              )}
              onClick={() => setLogOpen(!isLogOpen)}
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 sm:gap-2 border border-white/10 bg-[#0d1118] text-zinc-300 hover:bg-[#141b27] hover:text-white px-2 sm:px-3"
              onClick={() => sceneManagerRef.current?.resetScene()}
            >
              <LayoutPanelTop className="h-4 w-4" />
              <span className="hidden sm:inline">Recenter</span>
            </Button>
          </div>
        </div>

        {/* Resizable panel layout */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Action Log Panel (conditional) */}
            {!compact && isLogOpen && (
              <>
                <ResizablePanel defaultSize={18} minSize={10} maxSize={35} order={1}>
                  <ActionLogPanel />
                </ResizablePanel>
                <ResizableHandle className="w-[3px] bg-white/5 hover:bg-blue-500/30 transition-colors" />
              </>
            )}

            {/* Center: 3D Scene + Kanban */}
            <ResizablePanel defaultSize={isLogOpen && !compact ? 60 : 78} minSize={30} order={2}>
              <ResizablePanelGroup direction="vertical" className="h-full">
                {/* 3D Scene */}
                <ResizablePanel defaultSize={isKanbanOpen ? 65 : 100} minSize={30} order={1}>
                  <div className="relative h-full w-full bg-[#05070c]">
                    <div ref={canvasRef} className="absolute inset-0" data-scene-status={sceneStatus} />
                    <UIOverlay />
                    <CockpitSceneOverlay
                      companyName={snapshot.company.name}
                      errorMessage={sceneError}
                      status={sceneStatus}
                    />
                    <div className="pointer-events-none absolute left-3 top-3 flex max-w-xs items-start gap-2 rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-300" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">
                          Live brief
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-zinc-200 line-clamp-3">
                          {snapshot.company.brief}
                        </p>
                      </div>
                    </div>
                  </div>
                </ResizablePanel>

                {/* Kanban (conditional) */}
                {isKanbanOpen && (
                  <>
                    <ResizableHandle className="h-[3px] bg-white/5 hover:bg-blue-500/30 transition-colors" />
                    <ResizablePanel defaultSize={35} minSize={15} maxSize={60} order={2}>
                      <KanbanPanel />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>

            {/* Inspector Panel */}
            <ResizableHandle className="w-[3px] bg-white/5 hover:bg-blue-500/30 transition-colors" />
            <ResizablePanel defaultSize={22} minSize={12} maxSize={40} order={3}>
              <InspectorPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </SceneContext.Provider>
  );
}
