import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Network } from "lucide-react";
import { useActiveCompany } from "@/hooks/useActiveCompany";
import { useAgencyData } from "@/features/cockpit/lib/useAgencyData";
import { listAgentRecords } from "@/lib/server-api/agents";

// ── Layout constants ────────────────────────────────────────────────────

const CARD_W = 200;
const CARD_H = 100;
const GAP_X = 32;
const GAP_Y = 80;
const PADDING = 60;

// ── Types ───────────────────────────────────────────────────────────────

interface AgentRow {
  id: string;
  company_id: string;
  name: string;
  role: string;
  title: string | null;
  adapter_type: string;
  status: string;
  capabilities: string | null;
  reports_to: string | null;
  seat_index: number;
  private_cognition_enabled: boolean;
  adapter_config: Record<string, unknown>;
  adapter_overrides: Record<string, unknown>;
  venice_model: string | null;
  created_at: string;
  updated_at: string;
}

interface OrgNode {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
  reports: OrgNode[];
}

interface LayoutNode {
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
  x: number;
  y: number;
  children: LayoutNode[];
}

// ── Build org tree from flat agent rows ─────────────────────────────────

function buildOrgTree(agents: AgentRow[]): OrgNode[] {
  const nodeMap = new Map<string, OrgNode>();
  for (const agent of agents) {
    nodeMap.set(agent.id, {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      title: agent.title,
      status: agent.status,
      adapter_type: agent.adapter_type,
      reports: [],
    });
  }

  const roots: OrgNode[] = [];
  for (const agent of agents) {
    const node = nodeMap.get(agent.id)!;
    if (agent.reports_to && nodeMap.has(agent.reports_to)) {
      nodeMap.get(agent.reports_to)!.reports.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Layout algorithm ────────────────────────────────────────────────────

/** Compute the width each subtree needs. */
function subtreeWidth(node: OrgNode): number {
  if (node.reports.length === 0) return CARD_W;
  const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
  const gaps = (node.reports.length - 1) * GAP_X;
  return Math.max(CARD_W, childrenW + gaps);
}

/** Recursively assign x,y positions. */
function layoutTree(node: OrgNode, x: number, y: number): LayoutNode {
  const totalW = subtreeWidth(node);
  const layoutChildren: LayoutNode[] = [];

  if (node.reports.length > 0) {
    const childrenW = node.reports.reduce((sum, c) => sum + subtreeWidth(c), 0);
    const gaps = (node.reports.length - 1) * GAP_X;
    let cx = x + (totalW - childrenW - gaps) / 2;

    for (const child of node.reports) {
      const cw = subtreeWidth(child);
      layoutChildren.push(layoutTree(child, cx, y + CARD_H + GAP_Y));
      cx += cw + GAP_X;
    }
  }

  return {
    id: node.id,
    name: node.name,
    role: node.role,
    title: node.title,
    status: node.status,
    adapter_type: node.adapter_type,
    x: x + (totalW - CARD_W) / 2,
    y,
    children: layoutChildren,
  };
}

/** Layout all root nodes side by side. */
function layoutForest(roots: OrgNode[]): LayoutNode[] {
  if (roots.length === 0) return [];

  let x = PADDING;
  const y = PADDING;

  const result: LayoutNode[] = [];
  for (const root of roots) {
    const w = subtreeWidth(root);
    result.push(layoutTree(root, x, y));
    x += w + GAP_X;
  }

  return result;
}

/** Flatten layout tree to list of nodes. */
function flattenLayout(nodes: LayoutNode[]): LayoutNode[] {
  const result: LayoutNode[] = [];
  function walk(n: LayoutNode) {
    result.push(n);
    n.children.forEach(walk);
  }
  nodes.forEach(walk);
  return result;
}

/** Collect all parent→child edges. */
function collectEdges(nodes: LayoutNode[]): Array<{ parent: LayoutNode; child: LayoutNode }> {
  const edges: Array<{ parent: LayoutNode; child: LayoutNode }> = [];
  function walk(n: LayoutNode) {
    for (const c of n.children) {
      edges.push({ parent: n, child: c });
      walk(c);
    }
  }
  nodes.forEach(walk);
  return edges;
}

// ── Status dot colors ───────────────────────────────────────────────────

const statusDotColor: Record<string, string> = {
  running: "#22d3ee",
  active: "#4ade80",
  paused: "#facc15",
  idle: "#facc15",
  error: "#f87171",
  terminated: "#a3a3a3",
};
const defaultDotColor = "#a3a3a3";

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  gemini_local: "Gemini",
  opencode_local: "OpenCode",
  cursor: "Cursor",
  openclaw_gateway: "OpenClaw Gateway",
  process: "Process",
  http: "HTTP",
  pi_local: "Pi",
  hermes: "Hermes",
};

const roleLabels: Record<string, string> = {
  ceo: "CEO",
  cto: "CTO",
  coo: "COO",
  founding_engineer: "Founding Engineer",
  engineer: "Engineer",
  designer: "Designer",
  ops: "Operations",
  research: "Research",
  qa: "QA",
  pm: "Project Manager",
};

// ── Supabase hook with demo fallback ────────────────────────────────────

function useOrgAgents() {
  const { snapshot, isLoading: snapshotLoading } = useAgencyData();
  const { companyId, isLoading: companyLoading } = useActiveCompany();

  const agentsQuery = useQuery({
    queryKey: ["org-chart-agents", companyId],
    enabled: !companyLoading && !!companyId,
    queryFn: async () => {
      const records = await listAgentRecords({ companyId: companyId! });
      return records.map((agent) => ({
        id: agent.id,
        company_id: agent.company_id,
        name: agent.name,
        role: agent.role,
        title: agent.title,
        adapter_type: agent.adapter_type,
        status: agent.status,
        capabilities: null,
        reports_to: agent.reports_to,
        seat_index: 0,
        private_cognition_enabled: false,
        adapter_config: {},
        adapter_overrides: {},
        venice_model: null,
        created_at: agent.created_at,
        updated_at: agent.created_at,
      })) as AgentRow[];
    },
  });

  // If Supabase returns agents, use those. Otherwise fall back to demo data.
  const agents: AgentRow[] = useMemo(() => {
    if (agentsQuery.data && agentsQuery.data.length > 0) {
      return agentsQuery.data;
    }
    // Fall back to demo/snapshot agents
    return snapshot.agents.map((a) => ({
      id: a.id,
      company_id: a.companyId,
      name: a.name,
      role: a.role,
      title: a.title,
      adapter_type: a.adapterType,
      status: a.status,
      capabilities: a.capabilities,
      reports_to: a.reportsTo,
      seat_index: a.seatIndex,
      private_cognition_enabled: false,
      adapter_config: {},
      adapter_overrides: {},
      venice_model: null,
      created_at: a.createdAt,
      updated_at: a.updatedAt,
    }));
  }, [agentsQuery.data, snapshot.agents]);

  return {
    agents,
    isLoading: agentsQuery.isLoading && snapshotLoading,
  };
}

// ── Main component ──────────────────────────────────────────────────────

export function OrgChart() {
  const navigate = useNavigate();
  const { agents, isLoading } = useOrgAgents();

  // Build tree from flat agents
  const orgTree = useMemo(() => buildOrgTree(agents ?? []), [agents]);

  // Layout computation
  const layout = useMemo(() => layoutForest(orgTree), [orgTree]);
  const allNodes = useMemo(() => flattenLayout(layout), [layout]);
  const edges = useMemo(() => collectEdges(layout), [layout]);

  // Compute SVG bounds
  const bounds = useMemo(() => {
    if (allNodes.length === 0) return { width: 800, height: 600 };
    let maxX = 0;
    let maxY = 0;
    for (const n of allNodes) {
      maxX = Math.max(maxX, n.x + CARD_W);
      maxY = Math.max(maxY, n.y + CARD_H);
    }
    return { width: maxX + PADDING, height: maxY + PADDING };
  }, [allNodes]);

  // Pan & zoom state
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Auto-fit on first load
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current || allNodes.length === 0 || !containerRef.current) return;
    hasInitialized.current = true;

    const container = containerRef.current;
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const scaleX = (containerW - 40) / bounds.width;
    const scaleY = (containerH - 40) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);

    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;

    setZoom(fitZoom);
    setPan({
      x: (containerW - chartW) / 2,
      y: (containerH - chartH) / 2,
    });
  }, [allNodes, bounds]);

  // Fit helper reused by Fit button
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    const scaleX = (cW - 40) / bounds.width;
    const scaleY = (cH - 40) / bounds.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    const chartW = bounds.width * fitZoom;
    const chartH = bounds.height * fitZoom;
    setZoom(fitZoom);
    setPan({ x: (cW - chartW) / 2, y: (cH - chartH) / 2 });
  }, [bounds]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-org-card]")) return;
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);

      const scale = newZoom / zoom;
      setPan({
        x: mouseX - scale * (mouseX - pan.x),
        y: mouseY - scale * (mouseY - pan.y),
      });
      setZoom(newZoom);
    },
    [zoom, pan],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const newZoom = Math.min(Math.max(zoom * factor, 0.2), 2);
      const container = containerRef.current;
      if (container) {
        const cx = container.clientWidth / 2;
        const cy = container.clientHeight / 2;
        const scale = newZoom / zoom;
        setPan({ x: cx - scale * (cx - pan.x), y: cy - scale * (cy - pan.y) });
      }
      setZoom(newZoom);
    },
    [zoom, pan],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] text-zinc-500">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <Network className="h-8 w-8" />
          <span className="text-sm">Loading org chart…</span>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)] text-zinc-500">
        <div className="flex flex-col items-center gap-2">
          <Network className="h-8 w-8" />
          <span className="text-sm">No agents found. Create agents to see the org chart.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-4rem)] overflow-hidden relative bg-muted/20 border border-border rounded-lg"
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
        <button
          className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
          onClick={() => zoomBy(1.2)}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-sm hover:bg-accent transition-colors"
          onClick={() => zoomBy(0.8)}
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center bg-background border border-border rounded text-[10px] hover:bg-accent transition-colors"
          onClick={fitToScreen}
          title="Fit to screen"
          aria-label="Fit chart to screen"
        >
          Fit
        </button>
      </div>

      {/* SVG layer for edges */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {edges.map(({ parent, child }) => {
            const x1 = parent.x + CARD_W / 2;
            const y1 = parent.y + CARD_H;
            const x2 = child.x + CARD_W / 2;
            const y2 = child.y;
            const midY = (y1 + y2) / 2;

            return (
              <path
                key={`${parent.id}-${child.id}`}
                d={`M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`}
                fill="none"
                stroke="var(--border)"
                strokeWidth={1.5}
              />
            );
          })}
        </g>
      </svg>

      {/* Card layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {allNodes.map((node) => {
          const dotColor = statusDotColor[node.status] ?? defaultDotColor;

          return (
            <div
              key={node.id}
              data-org-card
              className="absolute bg-card border border-border rounded-lg shadow-sm hover:shadow-md hover:border-foreground/20 transition-[box-shadow,border-color] duration-150 cursor-pointer select-none"
              style={{
                left: node.x,
                top: node.y,
                width: CARD_W,
                minHeight: CARD_H,
              }}
              onClick={() => navigate(`/agents/${node.id}`)}
            >
              <div className="flex items-center px-4 py-3 gap-3">
                {/* Agent icon + status dot */}
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                    <Network className="h-4 w-4 text-foreground/70" />
                  </div>
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                    style={{ backgroundColor: dotColor }}
                    data-testid={`status-dot-${node.id}`}
                  />
                </div>
                {/* Name + role + adapter type */}
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="text-sm font-semibold text-foreground leading-tight">
                    {node.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {node.title ?? roleLabels[node.role] ?? node.role}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 font-mono leading-tight mt-1">
                    {adapterLabels[node.adapter_type] ?? node.adapter_type}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
