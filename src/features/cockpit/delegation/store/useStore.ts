import { create } from "zustand";

import type { CharacterState } from "../types";
import { DEFAULT_AGENT_SET_ID, getAgentSet } from "../data/agents";
import { useAgencyStore } from "./agencyStore";

export const useStore = create<CharacterState>()((set) => ({
  isThinking: false,
  instanceCount: getAgentSet(
    useAgencyStore.getState().selectedAgentSetId ?? DEFAULT_AGENT_SET_ID,
  ).agents.length,
  selectedNpcIndex: null,
  selectedPosition: null,
  hoveredNpcIndex: null,
  hoveredPoiId: null,
  hoveredPoiLabel: null,
  hoverPosition: null,
  npcScreenPositions: {},
  isChatting: false,
  isTyping: false,
  chatMessages: [],
  inspectorTab: "info",
  setThinking: (isThinking) => set({ isThinking }),
  setIsTyping: (isTyping) => set({ isTyping }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setInstanceCount: (instanceCount) => set({ instanceCount }),
  setSelectedNpc: (selectedNpcIndex) =>
    set({
      selectedNpcIndex,
      selectedPosition: null,
      isChatting: false,
      chatMessages: [],
      inspectorTab: "info",
    }),
  setSelectedPosition: (selectedPosition) => set({ selectedPosition }),
  setHoveredNpc: (hoveredNpcIndex, hoverPosition) =>
    set({
      hoveredNpcIndex,
      hoverPosition,
      hoveredPoiId: null,
      hoveredPoiLabel: null,
    }),
  setHoveredPoi: (hoveredPoiId, hoveredPoiLabel, hoverPosition) =>
    set({
      hoveredPoiId,
      hoveredPoiLabel,
      hoverPosition,
      hoveredNpcIndex: null,
    }),
}));

useAgencyStore.subscribe((state, prevState) => {
  if (state.selectedAgentSetId !== prevState.selectedAgentSetId) {
    useStore.getState().setInstanceCount(getAgentSet(state.selectedAgentSetId).agents.length);
  }
});
