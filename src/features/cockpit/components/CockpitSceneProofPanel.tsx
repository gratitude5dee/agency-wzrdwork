import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import type { CockpitSceneStatus } from "./CockpitSceneOverlay";

export interface SceneProofSnapshot {
  /** Scene lifecycle status: loading | ready | unsupported | error */
  sceneStatus: CockpitSceneStatus;
  /** Data source: "supabase" or "demo" */
  dataSource: string;
  /** Active company name */
  companyName: string;
  /** Current project phase */
  phase: string;
  /** NPC agent names from the runtime agent set (excludes the player) */
  npcNames: string[];
  /** Total NPC count (non-player agents rendered in the scene) */
  npcCount: number;
  /** ISO timestamp of the last snapshot sync */
  lastSyncAt: string;
  /** Optional error message from scene boot */
  errorMessage?: string | null;
}

interface CockpitSceneProofPanelProps {
  snapshot: SceneProofSnapshot;
}

/**
 * CockpitSceneProofPanel — validation affordance for headed/manual cockpit
 * scene proof.
 *
 * This panel renders machine-queryable `data-*` attributes on every
 * significant state value so that a headed browser validator (or a human
 * tester) can inspect live NPC population, backend-to-scene propagation,
 * and data source without reading internal JavaScript state.
 *
 * The panel collapses by default and is positioned at the bottom-right of
 * the scene container so it does not obscure the 3D viewport.
 */
export function CockpitSceneProofPanel({ snapshot }: CockpitSceneProofPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor =
    snapshot.sceneStatus === "ready"
      ? "text-emerald-400"
      : snapshot.sceneStatus === "loading"
        ? "text-blue-400"
        : snapshot.sceneStatus === "unsupported"
          ? "text-orange-400"
          : "text-red-400";

  return (
    <div
      className="pointer-events-auto absolute bottom-3 right-3 z-30 max-w-xs"
      data-testid="cockpit-scene-proof-panel"
      data-proof-scene-status={snapshot.sceneStatus}
      data-proof-data-source={snapshot.dataSource}
      data-proof-company-name={snapshot.companyName}
      data-proof-phase={snapshot.phase}
      data-proof-npc-count={snapshot.npcCount}
      data-proof-npc-names={snapshot.npcNames.join(",")}
      data-proof-last-sync={snapshot.lastSyncAt}
      data-proof-error={snapshot.errorMessage ?? ""}
    >
      <div className="rounded-xl border border-white/10 bg-[#090d15]/95 shadow-lg backdrop-blur">
        {/* Collapsed header — always visible */}
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
          onClick={() => setExpanded((prev) => !prev)}
          data-testid="cockpit-proof-toggle"
        >
          <Eye className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">
            Scene Proof
          </span>
          <span
            className={cn("ml-auto text-[10px] font-black uppercase tracking-widest", statusColor)}
          >
            {snapshot.sceneStatus}
          </span>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-zinc-500" />
          ) : (
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          )}
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="space-y-2 border-t border-white/10 px-3 pb-3 pt-2">
            <ProofRow label="Source" value={snapshot.dataSource} testId="proof-source" />
            <ProofRow label="Company" value={snapshot.companyName} testId="proof-company" />
            <ProofRow label="Phase" value={snapshot.phase} testId="proof-phase" />
            <ProofRow
              label="NPCs"
              value={`${snapshot.npcCount} agent${snapshot.npcCount !== 1 ? "s" : ""}`}
              testId="proof-npc-count"
            />
            {snapshot.npcNames.length > 0 && (
              <div data-testid="proof-npc-list" className="mt-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  Agent Names
                </p>
                <ul className="mt-1 space-y-0.5">
                  {snapshot.npcNames.map((name) => (
                    <li
                      key={name}
                      className="text-[11px] leading-tight text-zinc-300"
                      data-proof-agent-name={name}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ProofRow
              label="Last sync"
              value={new Date(snapshot.lastSyncAt).toLocaleTimeString()}
              testId="proof-last-sync"
            />
            {snapshot.errorMessage && (
              <ProofRow label="Error" value={snapshot.errorMessage} testId="proof-error" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ProofRow({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2" data-testid={testId}>
      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
        {label}
      </span>
      <span className="text-[11px] font-medium text-zinc-300">{value}</span>
    </div>
  );
}
