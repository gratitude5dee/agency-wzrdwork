import { useEffect, useMemo, useRef, useState } from "react";
import { History, LayoutPanelTop, ShieldCheck, Sparkles, Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#05070c] text-zinc-100">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#070a11] px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
              Delegation cockpit
            </p>
            <h2 className="mt-1 text-2xl font-black">{snapshot.company.name}</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-400">{snapshot.company.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300">
              {snapshot.agents.length} agents
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300">
              {liveRunCount} live runs
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-orange-300">
              {pendingApprovals} approvals
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-[#0d1118] text-zinc-300">
              {openIssues} open tasks
            </Badge>
            {snapshot.source !== "supabase" && (
              <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-200">
                demo data
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {!compact && isLogOpen ? <ActionLogPanel /> : null}

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#0c1017] px-5 py-3">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-blue-300" />
                <span className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
                  Autonomous company
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 border border-white/10 bg-[#0d1118] text-zinc-300 hover:bg-[#141b27] hover:text-white",
                    isLogOpen && !compact ? "border-blue-500/30 text-blue-200" : "",
                  )}
                  onClick={() => setLogOpen(!isLogOpen)}
                >
                  <History className="h-4 w-4" />
                  Logs
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 border border-white/10 bg-[#0d1118] text-zinc-300 hover:bg-[#141b27] hover:text-white"
                  onClick={() => sceneManagerRef.current?.resetScene()}
                >
                  <LayoutPanelTop className="h-4 w-4" />
                  Recenter
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 bg-[#05070c]">
              <div className="relative min-w-0 flex-1">
                <div ref={canvasRef} className="absolute inset-0" data-scene-status={sceneStatus} />
                <UIOverlay />
                <CockpitSceneOverlay
                  companyName={snapshot.company.name}
                  errorMessage={sceneError}
                  status={sceneStatus}
                />
                <div className="pointer-events-none absolute left-5 top-5 flex max-w-sm items-start gap-3 rounded-2xl border border-white/10 bg-black/55 px-4 py-3 backdrop-blur">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                      Live brief
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-200">
                      {snapshot.company.brief}
                    </p>
                  </div>
                </div>
              </div>

              <InspectorPanel />
            </div>

            {isKanbanOpen && <KanbanPanel height={280} />}
          </div>
        </div>
      </div>
    </SceneContext.Provider>
  );
}
