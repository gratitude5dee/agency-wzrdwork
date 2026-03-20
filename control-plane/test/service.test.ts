import test from "node:test";
import assert from "node:assert/strict";

import { ControlPlaneService } from "../dist/service.js";
import type { AdapterRegistry } from "../src/adapters.ts";
import type { ControlPlaneConfig } from "../src/config.ts";
import type { JsonObject } from "../src/types.ts";

interface AgentState {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  status: string;
  adapter_type: string;
  adapter_config: Record<string, unknown>;
}

interface RuntimeStateRow {
  agent_id: string;
  company_id: string;
  state_data: Record<string, unknown>;
}

interface WakeupState {
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

interface HeartbeatRunState {
  id: string;
  agent_id: string;
  company_id: string;
  trigger_type: "manual" | "timer";
  status: string;
  wakeup_request_id: string | null;
  run_id: string | null;
  summary: string | null;
  error: string | null;
  trigger_payload: JsonObject;
  total_input_tokens?: number | null;
  total_output_tokens?: number | null;
  total_cost_usd?: number | null;
}

interface RunState {
  id: string;
  company_id: string;
  agent_id: string;
  issue_id: string | null;
  status: string;
  summary: string | null;
  stdout_excerpt?: string | null;
  stderr_excerpt?: string | null;
  error?: string | null;
  total_input_tokens?: number | null;
  total_output_tokens?: number | null;
  total_cached_input_tokens?: number | null;
  total_cost_usd?: number | null;
}

interface ActivityEventState {
  company_id: string;
  agent_id: string;
  issue_id: string | null;
  action: string;
  details: string;
}

interface ExecutionLogState {
  company_id: string;
  agent_id: string;
  run_id: string;
  log_type: string;
  content: JsonObject;
}

interface HeartbeatRunEventState {
  run_id: string;
  event_type: string;
  payload: JsonObject;
}

interface MemoryState {
  agents: AgentState[];
  runtimeStates: Map<string, RuntimeStateRow>;
  wakeups: WakeupState[];
  heartbeatRuns: HeartbeatRunState[];
  runs: RunState[];
  activityEvents: ActivityEventState[];
  executionLogs: ExecutionLogState[];
  heartbeatRunEvents: HeartbeatRunEventState[];
  ids: number;
}

function createConfig(): ControlPlaneConfig {
  return {
    databaseUrl: "postgresql://example/test",
    disablePreparedStatements: false,
    workerId: "worker-test",
    pollIntervalMs: 10,
    schedulerIntervalMs: 1000,
    staleClaimMs: 60_000,
    maxAttempts: 2,
    allowedProcessCommands: ["node"],
    allowedCodexCommands: ["codex"],
    defaultCodexCommand: "codex",
    encryptionKey: Buffer.alloc(32, 1),
  };
}

function createAdapterRegistry(): AdapterRegistry {
  return {
    get(adapterType: string) {
      if (adapterType !== "process") return undefined;
      return {
        type: "process",
        async resolveSecrets(rawConfig) {
          return { config: rawConfig, sensitiveValues: [] };
        },
        async executeStep(input) {
          return {
            stdout: JSON.stringify({ step: input.step }),
            stderr: "",
            exitCode: 0,
            usage: {
              inputTokens: 1,
              cachedInputTokens: 0,
              outputTokens: 1,
              costUsd: 0.01,
            },
          };
        },
        parseOutput(input, execution) {
          return {
            summary: `${input.step} ok`,
            data: {
              step: input.step,
              stdout: execution.stdout,
            },
            usage: execution.usage,
          };
        },
      };
    },
    async resolveConfig(_adapterType: string, _companyId: string, rawConfig: JsonObject) {
      return {
        config: rawConfig,
        sensitiveValues: [],
      };
    },
  };
}

function createMemoryState(overrides?: Partial<MemoryState>): MemoryState {
  return {
    agents: [],
    runtimeStates: new Map(),
    wakeups: [],
    heartbeatRuns: [],
    runs: [],
    activityEvents: [],
    executionLogs: [],
    heartbeatRunEvents: [],
    ids: 0,
    ...overrides,
  };
}

function nextId(state: MemoryState, prefix: string): string {
  state.ids += 1;
  return `${prefix}-${state.ids}`;
}

function normalize(strings: TemplateStringsArray): string {
  return strings.join("?").replace(/\s+/g, " ").trim();
}

function createSql(state: MemoryState) {
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = normalize(strings);

    if (text.startsWith("SELECT a.id, a.company_id, a.name, a.role, a.status, a.adapter_type, a.adapter_config, ars.state_data FROM public.agents a")) {
      return state.agents
        .filter((agent) => {
          const heartbeatEnabled = agent.adapter_config.heartbeatEnabled === true;
          const intervalSec = Number(agent.adapter_config.intervalSec ?? 0);
          return heartbeatEnabled && intervalSec > 0 && !["paused", "terminated"].includes(agent.status);
        })
        .map((agent) => ({
          ...agent,
          adapter_config: agent.adapter_config,
          state_data: state.runtimeStates.get(agent.id)?.state_data ?? null,
        }));
    }

    if (text.startsWith("SELECT * FROM public.enqueue_agent_wakeup(")) {
      const [agentId, companyId, reason, triggerType, payload] = values as [
        string,
        string,
        string,
        "manual" | "timer",
        JsonObject,
      ];

      if (triggerType === "timer") {
        const existing = state.wakeups.find(
          (wakeup) =>
            wakeup.agent_id === agentId &&
            wakeup.trigger_type === "timer" &&
            (wakeup.status === "pending" || wakeup.status === "claimed"),
        );
        if (existing) {
          return [
            {
              wakeup_request_id: existing.id,
              heartbeat_run_id: existing.heartbeat_run_id,
            },
          ];
        }
      }

      const heartbeatRunId = nextId(state, "heartbeat");
      const wakeupId = nextId(state, "wakeup");

      state.heartbeatRuns.push({
        id: heartbeatRunId,
        agent_id: agentId,
        company_id: companyId,
        trigger_type: triggerType,
        status: "pending",
        wakeup_request_id: wakeupId,
        run_id: null,
        summary: reason || null,
        error: null,
        trigger_payload: payload ?? {},
      });

      state.wakeups.push({
        id: wakeupId,
        company_id: companyId,
        agent_id: agentId,
        reason,
        trigger_type: triggerType,
        status: "pending",
        payload: payload ?? {},
        created_at: new Date().toISOString(),
        resolved_at: null,
        claimed_at: null,
        claimed_by: null,
        attempt_count: 0,
        last_error: null,
        run_id: null,
        heartbeat_run_id: heartbeatRunId,
      });

      return [{ wakeup_request_id: wakeupId, heartbeat_run_id: heartbeatRunId }];
    }

    if (text.startsWith("INSERT INTO public.agent_runtime_state")) {
      const [agentId, companyId, stateData] = values as [string, string, Record<string, unknown>];
      state.runtimeStates.set(agentId, {
        agent_id: agentId,
        company_id: companyId,
        state_data: stateData,
      });
      return [];
    }

    if (text.startsWith("WITH candidate AS ( SELECT id FROM public.agent_wakeup_requests")) {
      const [staleClaimMs, workerId] = values as [number, string];
      const now = Date.now();
      const candidate = state.wakeups.find((wakeup) => {
        if (wakeup.status === "pending") return true;
        if (wakeup.status !== "claimed" || !wakeup.claimed_at) return false;
        return new Date(wakeup.claimed_at).getTime() < now - staleClaimMs;
      });

      if (!candidate) return [];

      candidate.status = "claimed";
      candidate.claimed_at = new Date().toISOString();
      candidate.claimed_by = workerId;
      candidate.attempt_count += 1;
      candidate.last_error = null;
      return [{ ...candidate }];
    }

    if (text.startsWith("SELECT req.*, a.adapter_type, a.adapter_config, a.name AS agent_name")) {
      const [wakeupId] = values as [string];
      const wakeup = state.wakeups.find((entry) => entry.id === wakeupId);
      if (!wakeup) return [];
      const agent = state.agents.find((entry) => entry.id === wakeup.agent_id);
      if (!agent) return [];
      return [
        {
          ...wakeup,
          adapter_type: agent.adapter_type,
          adapter_config: agent.adapter_config,
          agent_name: agent.name,
          agent_role: agent.role,
          agent_status: agent.status,
          state_data: state.runtimeStates.get(agent.id)?.state_data ?? null,
        },
      ];
    }

    if (text.startsWith("SELECT state_data FROM public.agent_runtime_state WHERE agent_id = ? LIMIT 1")) {
      const [agentId] = values as [string];
      const row = state.runtimeStates.get(agentId);
      return [{ state_data: row?.state_data ?? null }];
    }

    if (text.startsWith("INSERT INTO public.runs")) {
      const [companyId, issueId, agentId, summary] = values as [
        string,
        string | null,
        string,
        string,
      ];
      const run = {
        id: nextId(state, "run"),
        company_id: companyId,
        issue_id: issueId,
        agent_id: agentId,
        status: "running",
        summary,
      };
      state.runs.push(run);
      return [{ id: run.id }];
    }

    if (text.startsWith("UPDATE public.agent_wakeup_requests SET run_id = ?::uuid WHERE id = ?::uuid")) {
      const [runId, wakeupId] = values as [string, string];
      const wakeup = state.wakeups.find((entry) => entry.id === wakeupId);
      if (wakeup) wakeup.run_id = runId;
      return [];
    }

    if (text.startsWith("UPDATE public.heartbeat_runs SET status = 'running'")) {
      const [summary, runId, heartbeatRunId] = values as [string, string, string];
      const heartbeat = state.heartbeatRuns.find((entry) => entry.id === heartbeatRunId);
      if (heartbeat) {
        heartbeat.status = "running";
        heartbeat.summary = summary;
        heartbeat.error = null;
        heartbeat.run_id = runId;
      }
      return [];
    }

    if (text.startsWith("UPDATE public.agents SET status = 'running'")) {
      const [agentId] = values as [string];
      const agent = state.agents.find((entry) => entry.id === agentId);
      if (agent) agent.status = "running";
      return [];
    }

    if (text.startsWith("UPDATE public.agents SET status = 'idle'")) {
      const [agentId] = values as [string];
      const agent = state.agents.find((entry) => entry.id === agentId);
      if (agent) agent.status = "idle";
      return [];
    }

    if (text.startsWith("UPDATE public.agents SET status = 'error'")) {
      const [agentId] = values as [string];
      const agent = state.agents.find((entry) => entry.id === agentId);
      if (agent) agent.status = "error";
      return [];
    }

    if (text.startsWith("INSERT INTO public.activity_events")) {
      const [companyId, agentId, issueId, action, details] = values as [
        string,
        string,
        string | null,
        string,
        string,
      ];
      state.activityEvents.push({
        company_id: companyId,
        agent_id: agentId,
        issue_id: issueId,
        action,
        details,
      });
      return [];
    }

    if (text.startsWith("INSERT INTO public.heartbeat_run_events")) {
      const [runId, eventType, payload] = values as [string, string, JsonObject];
      state.heartbeatRunEvents.push({
        run_id: runId,
        event_type: eventType,
        payload,
      });
      return [];
    }

    if (text.startsWith("INSERT INTO public.agent_execution_logs")) {
      const [companyId, agentId, runId, logType, content] = values as [
        string,
        string,
        string,
        string,
        JsonObject,
      ];
      state.executionLogs.push({
        company_id: companyId,
        agent_id: agentId,
        run_id: runId,
        log_type: logType,
        content,
      });
      return [];
    }

    if (text.startsWith("UPDATE public.runs SET status = 'completed'")) {
      const [summary, stdoutExcerpt, stderrExcerpt, inputTokens, outputTokens, cachedInputTokens, costUsd, runId] =
        values as [string, string, string, number, number, number, number, string];
      const run = state.runs.find((entry) => entry.id === runId);
      if (run) {
        run.status = "completed";
        run.summary = summary;
        run.stdout_excerpt = stdoutExcerpt;
        run.stderr_excerpt = stderrExcerpt;
        run.error = null;
        run.total_input_tokens = inputTokens;
        run.total_output_tokens = outputTokens;
        run.total_cached_input_tokens = cachedInputTokens;
        run.total_cost_usd = costUsd;
      }
      return [];
    }

    if (text.startsWith("UPDATE public.agent_wakeup_requests SET status = 'completed'")) {
      const [runId, wakeupId] = values as [string, string];
      const wakeup = state.wakeups.find((entry) => entry.id === wakeupId);
      if (wakeup) {
        wakeup.status = "completed";
        wakeup.resolved_at = new Date().toISOString();
        wakeup.last_error = null;
        wakeup.run_id = runId;
      }
      return [];
    }

    if (text.startsWith("UPDATE public.heartbeat_runs SET status = 'completed'")) {
      const [summary, runId, inputTokens, outputTokens, costUsd, heartbeatRunId] = values as [
        string,
        string,
        number,
        number,
        number,
        string,
      ];
      const heartbeat = state.heartbeatRuns.find((entry) => entry.id === heartbeatRunId);
      if (heartbeat) {
        heartbeat.status = "completed";
        heartbeat.summary = summary;
        heartbeat.error = null;
        heartbeat.run_id = runId;
        heartbeat.total_input_tokens = inputTokens;
        heartbeat.total_output_tokens = outputTokens;
        heartbeat.total_cost_usd = costUsd;
      }
      return [];
    }

    throw new Error(`Unhandled query: ${text}`);
  }) as {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
    begin: <T>(cb: (sql: typeof sql) => Promise<T>) => Promise<T>;
    json: (value: unknown) => unknown;
  };

  sql.begin = async (cb) => cb(sql);
  sql.json = (value) => value;

  return sql;
}

test("workerTick processes a manual wakeup into a completed run with events and logs", async () => {
  const state = createMemoryState({
    agents: [
      {
        id: "agent-1",
        company_id: "company-1",
        name: "Manual Agent",
        role: "engineer",
        status: "idle",
        adapter_type: "process",
        adapter_config: {
          heartbeatEnabled: false,
          intervalSec: 30,
        },
      },
    ],
    wakeups: [
      {
        id: "wake-1",
        company_id: "company-1",
        agent_id: "agent-1",
        reason: "Manual wakeup for Manual Agent",
        trigger_type: "manual",
        status: "pending",
        payload: { task: "Manual wakeup for Manual Agent" },
        created_at: "2026-03-20T00:00:00.000Z",
        resolved_at: null,
        claimed_at: null,
        claimed_by: null,
        attempt_count: 0,
        last_error: null,
        run_id: null,
        heartbeat_run_id: "heartbeat-1",
      },
    ],
    heartbeatRuns: [
      {
        id: "heartbeat-1",
        agent_id: "agent-1",
        company_id: "company-1",
        trigger_type: "manual",
        status: "pending",
        wakeup_request_id: "wake-1",
        run_id: null,
        summary: null,
        error: null,
        trigger_payload: { task: "Manual wakeup for Manual Agent" },
      },
    ],
  });

  const service = new ControlPlaneService(
    createSql(state) as never,
    createConfig(),
    createAdapterRegistry(),
  );

  await service.workerTick();

  assert.equal(state.runs.length, 1);
  assert.equal(state.runs[0]?.status, "completed");
  assert.equal(state.runs[0]?.summary, "submit ok");
  assert.equal(state.wakeups[0]?.status, "completed");
  assert.equal(state.heartbeatRuns[0]?.status, "completed");
  assert.equal(state.executionLogs.length, 5);
  assert.equal(state.activityEvents.length, 2);
  assert.equal(
    state.heartbeatRunEvents.filter((event) => event.run_id === "heartbeat-1").length,
    12,
  );
  assert.equal(state.agents[0]?.status, "idle");
  assert.equal(
    state.runtimeStates.get("agent-1")?.state_data.activeWakeupRequestId,
    null,
  );
});

test("schedulerTick enqueues timer wakeups once while active and again after completion window", async () => {
  const state = createMemoryState({
    agents: [
      {
        id: "agent-1",
        company_id: "company-1",
        name: "Scheduled Agent",
        role: "operator",
        status: "idle",
        adapter_type: "process",
        adapter_config: {
          heartbeatEnabled: true,
          intervalSec: 30,
        },
      },
    ],
  });

  const service = new ControlPlaneService(
    createSql(state) as never,
    createConfig(),
    createAdapterRegistry(),
  );

  const firstTick = new Date("2026-03-20T12:00:00.000Z");
  await service.schedulerTick(firstTick);
  await service.schedulerTick(new Date("2026-03-20T12:00:05.000Z"));

  assert.equal(state.wakeups.length, 1);
  assert.equal(state.heartbeatRuns.length, 1);
  assert.equal(
    state.runtimeStates.get("agent-1")?.state_data.activeWakeupRequestId,
    state.wakeups[0]?.id,
  );

  await service.workerTick();

  const nextHeartbeatAt = state.runtimeStates.get("agent-1")?.state_data.nextHeartbeatAt;
  assert.ok(typeof nextHeartbeatAt === "string");
  assert.equal(state.wakeups[0]?.status, "completed");
  assert.equal(state.heartbeatRuns[0]?.status, "completed");

  await service.schedulerTick(new Date(Date.parse(nextHeartbeatAt as string) + 1000));

  assert.equal(state.wakeups.length, 2);
  assert.equal(state.heartbeatRuns.length, 2);
  assert.equal(state.wakeups[1]?.trigger_type, "timer");
  assert.equal(state.wakeups[1]?.status, "pending");
});
