import React from "react";
import { useStore } from "../store/useStore";
import { useAgencyStore } from "../store/agencyStore";
import AgentView from "./AgentView";
import ProjectView from "./ProjectView";
import { getAgentSet } from "../data/agents";

interface InspectorPanelProps {
  isFloating?: boolean;
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({ isFloating }) => {
  const { selectedNpcIndex, isChatting } = useStore();
  const { selectedAgentSetId } = useAgencyStore();
  const agents = getAgentSet(selectedAgentSetId).agents;
  const agent = selectedNpcIndex !== null ? agents.find(a => a.index === selectedNpcIndex) ?? null : null;

  return (
    <div className={`${isFloating ? 'w-full h-full max-h-[85vh] self-end rounded-2xl shadow-2xl border border-white/15' : 'w-full h-full border-l border-white/10'} glass-panel flex flex-col pointer-events-auto relative z-30 overflow-hidden transition-all duration-300`}>
      {!agent ? (
        !isFloating && <ProjectView />
      ) : (
        <>
          <div className={`p-4 pb-1 border-b border-white/10 bg-[#0c1017] ${isFloating ? 'bg-[#10151f]' : ''}`}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: agent.color }}
                    />
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      {agent.department}
                    </p>
                  </div>
                  <h2 className="text-xl font-black text-zinc-50 leading-tight">
                    {agent.role}
                  </h2>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0f141d] px-3 py-2 text-[11px] font-medium text-zinc-400">
                Inspector is synced to the current company snapshot.
              </div>
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto relative min-h-0 ${isFloating ? 'bg-[#070a11]' : 'bg-[#070a11]'}`}>
            <div className="flex flex-col h-full">
              <div className="flex-1">
                <AgentView agentIndex={selectedNpcIndex!} />
              </div>
              {isChatting && (
                <div className="border-t border-white/10 bg-[#0c1017] px-4 py-3 text-[11px] text-zinc-500">
                  Direct chat is disabled. Use the issue and approval pages for live coordination.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default InspectorPanel;
