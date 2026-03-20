export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export type LoopStep = "discover" | "plan" | "execute" | "verify" | "submit";

export interface TokenUsage extends JsonObject {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface StepRecord {
  step: LoopStep;
  summary: string;
  data: JsonObject;
  usage: TokenUsage;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface RuntimeStateData extends JsonObject {
  lastHeartbeatAt?: string;
  nextHeartbeatAt?: string;
  consecutiveFailures?: number;
  activeWakeupRequestId?: string | null;
}

export interface WakeupRequestRow {
  id: string;
  company_id: string;
  agent_id: string;
  reason: string;
  trigger_type: "manual" | "timer";
  status: "pending" | "claimed" | "completed" | "failed";
  payload: JsonObject;
  created_at: string;
  resolved_at: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  attempt_count: number;
  last_error: string | null;
  run_id: string | null;
  heartbeat_run_id: string | null;
}

export interface AgentRow {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  status: string;
  adapter_type: string;
  adapter_config: JsonObject | null;
}

export interface RuntimeStateRow {
  id: string;
  agent_id: string;
  company_id: string;
  state_data: RuntimeStateData;
  updated_at: string;
}

export interface ScheduledAgentRow extends AgentRow {
  state_data: RuntimeStateData | null;
}

export interface ClaimedWakeupContext {
  wakeup: WakeupRequestRow;
  agent: AgentRow;
  runtimeState: RuntimeStateData;
}

export interface RunRow {
  id: string;
  company_id: string;
  agent_id: string;
  issue_id: string | null;
  status: string;
  summary: string | null;
}

export interface AdapterResolution {
  config: JsonObject;
  sensitiveValues: string[];
}

export interface AdapterStepInput {
  step: LoopStep;
  task: string;
  agent: AgentRow;
  previousSteps: StepRecord[];
  rawConfig: JsonObject;
  resolvedConfig: JsonObject;
}

export interface AdapterStepExecution {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  statusCode?: number;
  usage: TokenUsage;
}

export interface ParsedAdapterOutput {
  summary: string;
  data: JsonObject;
  usage?: Partial<TokenUsage>;
}

export interface AdapterExecutionModule {
  type: string;
  executeStep(input: AdapterStepInput): Promise<AdapterStepExecution>;
  parseOutput(input: AdapterStepInput, execution: AdapterStepExecution): ParsedAdapterOutput;
  resolveSecrets(
    rawConfig: JsonObject,
    resolveMany: (identifiers: string[]) => Promise<Map<string, string>>,
  ): Promise<AdapterResolution>;
}
