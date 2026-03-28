import type * as THREE from "three/webgpu";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  timestamp: string;
}

export interface CharacterState {
  isThinking: boolean;
  instanceCount: number;
  selectedNpcIndex: number | null;
  selectedPosition: { x: number; y: number } | null;
  hoveredNpcIndex: number | null;
  hoveredPoiId: string | null;
  hoveredPoiLabel: string | null;
  hoverPosition: { x: number; y: number } | null;
  npcScreenPositions: Record<number, { x: number; y: number }>;
  isChatting: boolean;
  isTyping: boolean;
  chatMessages: ChatMessage[];
  inspectorTab: "info" | "chat";
  setThinking: (isThinking: boolean) => void;
  setIsTyping: (isTyping: boolean) => void;
  setInspectorTab: (tab: "info" | "chat") => void;
  setInstanceCount: (count: number) => void;
  setSelectedNpc: (index: number | null) => void;
  setSelectedPosition: (pos: { x: number; y: number } | null) => void;
  setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => void;
  setHoveredPoi: (
    id: string | null,
    label: string | null,
    pos: { x: number; y: number } | null,
  ) => void;
}

export enum AnimationName {
  IDLE = "Idle",
  WALK = "Walk",
  TALK = "Talk",
  LISTEN = "Listen",
  SIT_DOWN = "Sit",
  SIT_IDLE = "Sit_Idle",
  SIT_WORK = "Sit_Work",
  LOOK_AROUND = "LookAround",
  HAPPY = "Happy",
  SAD = "Sad",
  PICK = "Pick",
  WAVE = "Wave",
}

export enum AgentBehavior {
  IDLE = 0,
  GOTO = 1,
  SEATED = 2,
}

export type CharacterStateKey =
  | "idle"
  | "walk"
  | "talk"
  | "listen"
  | "sit_down"
  | "sit_idle"
  | "sit_work"
  | "look_around"
  | "happy"
  | "happy_loop"
  | "sad"
  | "pick"
  | "wave"
  | "wave_loop";

export interface CharacterStateDef {
  animation: AnimationName;
  expression?: ExpressionKey;
  loop: boolean;
  durationOverride?: number;
  nextState?: CharacterStateKey;
  interruptible: boolean;
}

export interface PoiDef {
  id: string;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  arrivalState: CharacterStateKey;
  occupiedBy: number | null;
  label?: string;
}

export interface ICharacterDriver {
  setPhysicsMode(index: number, mode: AgentBehavior): void;
  setAnimation(index: number, name: AnimationName, loop?: boolean): void;
  setExpression(index: number, key: ExpressionKey): void;
  setSpeaking(index: number, isSpeaking: boolean): void;
  getAgentState(index: number): AgentBehavior;
  getAnimationDuration(name: AnimationName): number;
  getCPUPositions(): Float32Array | null;
}

export interface IAgentDriver {
  readonly agentIndex: number;
  update(positions: Float32Array, delta: number): void;
  dispose(): void;
}

export type ExpressionKey =
  | "idle"
  | "listening"
  | "neutral"
  | "surprised"
  | "happy"
  | "sick"
  | "wink"
  | "doubtful"
  | "sad";

export interface AtlasCoords {
  col: number;
  row: number;
}

export interface ExpressionConfig {
  eyes: AtlasCoords;
  mouth: AtlasCoords;
}
