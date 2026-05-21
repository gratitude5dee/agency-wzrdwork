import { create } from "zustand";

import type { AgentSet } from "../data/agents";
import { DEFAULT_AGENT_SET_ID, getAgentSet } from "../data/agents";
import type { AgentInspectorModel, ProjectInspectorModel } from "./inspector";
import type { IssueStatus } from "../../lib/domain";

export type TaskStatus = IssueStatus;

export type AgentVisualState =
  | "idle"
  | "queued"
  | "working"
  | "heartbeat_tick"
  | "awaiting_approval"
  | "blocked"
  | "over_budget"
  | "paused"
  | "failed"
  | "completed"
  | "needs_input"
  | "producing_work_product"
  | "terminated";

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedAgentIds: number[];
  status: TaskStatus;
  parentTaskId?: string;
  requiresClientApproval: boolean;
  output?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ActionLogEntry {
  id: string;
  timestamp: number;
  agentIndex: number;
  action: string;
  taskId?: string;
}

export interface DebugMessage {
  role: string;
  content: string;
}

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  agentIndex: number;
  agentName: string;
  phase: "request" | "response";
  systemPrompt: string;
  dynamicContext: string;
  messages: DebugMessage[];
  rawContent: string;
  status: "pending" | "completed" | "error";
  taskId?: string;
}

export type ProjectPhase =
  | "idle"
  | "briefing"
  | "working"
  | "awaiting_approval"
  | "over_budget"
  | "failed"
  | "done";

interface RuntimePayload {
  clientBrief: string;
  phase: ProjectPhase;
  tasks: Task[];
  actionLog: ActionLogEntry[];
  debugLog: DebugLogEntry[];
  projectInspector: ProjectInspectorModel | null;
  agentInspectors: Record<number, AgentInspectorModel>;
  agentVisualStates: Record<number, AgentVisualState>;
  selectedAgentSetId?: string;
}

interface AgencyState {
  clientBrief: string;
  phase: ProjectPhase;
  finalOutput: string | null;
  tasks: Task[];
  actionLog: ActionLogEntry[];
  debugLog: DebugLogEntry[];
  agentHistories: Record<number, DebugMessage[]>;
  agentSummaries: Record<number, string>;
  boardroomHistories: Record<string, DebugMessage[]>;
  projectInspector: ProjectInspectorModel | null;
  agentInspectors: Record<number, AgentInspectorModel>;
  agentVisualStates: Record<number, AgentVisualState>;
  selectedAgentSetId: string;
  isKanbanOpen: boolean;
  isLogOpen: boolean;
  isFinalOutputOpen: boolean;
  pendingApprovalTaskId: string | null;
  logFilterAgentIndex: number | null;
  isResizing: boolean;
  isPaused: boolean;
  pauseOnCall: boolean;
  setRuntimeData: (payload: RuntimePayload) => void;
  setPhase: (phase: ProjectPhase) => void;
  setFinalOutput: (output: string | null) => void;
  setKanbanOpen: (open: boolean) => void;
  setLogOpen: (open: boolean, filterAgent?: number | null) => void;
  setFinalOutputOpen: (open: boolean) => void;
  setPendingApproval: (taskId: string | null) => void;
  setIsResizing: (isResizing: boolean) => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  setAgentSet: (id: string) => void;
  resetProject: () => void;
}

const INITIAL_STATE = {
  clientBrief: "",
  phase: "idle" as ProjectPhase,
  finalOutput: null,
  tasks: [] as Task[],
  actionLog: [] as ActionLogEntry[],
  debugLog: [] as DebugLogEntry[],
  agentHistories: {} as Record<number, DebugMessage[]>,
  agentSummaries: {} as Record<number, string>,
  boardroomHistories: {} as Record<string, DebugMessage[]>,
  projectInspector: null as ProjectInspectorModel | null,
  agentInspectors: {} as Record<number, AgentInspectorModel>,
  agentVisualStates: {} as Record<number, AgentVisualState>,
  selectedAgentSetId: DEFAULT_AGENT_SET_ID,
  isKanbanOpen: true,
  isLogOpen: true,
  isFinalOutputOpen: false,
  pendingApprovalTaskId: null as string | null,
  logFilterAgentIndex: null as number | null,
  isResizing: false,
  isPaused: false,
  pauseOnCall: false,
};

export const useAgencyStore = create<AgencyState>()((set) => ({
  ...INITIAL_STATE,
  setRuntimeData: (payload) =>
    set((state) => ({
      clientBrief: payload.clientBrief,
      phase: payload.phase,
      tasks: payload.tasks,
      actionLog: payload.actionLog,
      debugLog: payload.debugLog,
      projectInspector: payload.projectInspector,
      agentInspectors: payload.agentInspectors,
      agentVisualStates: payload.agentVisualStates,
      selectedAgentSetId: payload.selectedAgentSetId ?? state.selectedAgentSetId,
      pendingApprovalTaskId:
        payload.tasks.find((task) => task.requiresClientApproval || task.status === "blocked")?.id ?? null,
      isLogOpen: payload.actionLog.length > 0 || payload.debugLog.length > 0,
    })),
  setPhase: (phase) => set({ phase }),
  setFinalOutput: (finalOutput) => set({ finalOutput }),
  setKanbanOpen: (isKanbanOpen) => set({ isKanbanOpen }),
  setLogOpen: (isLogOpen, logFilterAgentIndex = null) =>
    set({ isLogOpen, logFilterAgentIndex }),
  setFinalOutputOpen: (isFinalOutputOpen) => set({ isFinalOutputOpen }),
  setPendingApproval: (pendingApprovalTaskId) => set({ pendingApprovalTaskId }),
  setIsResizing: (isResizing) => set({ isResizing }),
  togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
  setPaused: (isPaused) => set({ isPaused }),
  setAgentSet: (selectedAgentSetId) => set({ selectedAgentSetId }),
  resetProject: () =>
    set({
      ...INITIAL_STATE,
      selectedAgentSetId: DEFAULT_AGENT_SET_ID,
    }),
}));

export function getActiveAgentSet(): AgentSet {
  return getAgentSet(useAgencyStore.getState().selectedAgentSetId);
}
