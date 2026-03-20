import type { Sql } from "postgres";
import { createAdapterRegistry, type AdapterRegistry } from "./adapters.js";
import type { ControlPlaneConfig } from "./config.js";
import {
  claimNextWakeup,
  enqueueWakeup,
  listScheduledAgents,
  loadClaimedWakeupContext,
  loadRuntimeState,
  upsertRuntimeState,
  type DbExecutor,
} from "./repository.js";
import { redactJsonValue, redactText } from "./redaction.js";
import type {
  ClaimedWakeupContext,
  JsonObject,
  LoopStep,
  RuntimeStateData,
  StepRecord,
  TokenUsage,
} from "./types.js";
import {
  asObject,
  isSupportedExecutionAdapter,
  isHeartbeatDue,
  mergeRuntimeState,
  nextIntervalIso,
  normalizeUsage,
  parseHeartbeatSettings,
  shouldRetryWakeup,
  summarizeTask,
  toErrorMessage,
  toJsonValue,
  truncate,
} from "./utils.js";

const LOOP_STEPS: LoopStep[] = [
  "discover",
  "plan",
  "execute",
  "verify",
  "submit",
];

function addUsage(left: TokenUsage, right: Partial<TokenUsage> | undefined): TokenUsage {
  const normalized = normalizeUsage(right);
  return {
    inputTokens: left.inputTokens + normalized.inputTokens,
    cachedInputTokens: left.cachedInputTokens + normalized.cachedInputTokens,
    outputTokens: left.outputTokens + normalized.outputTokens,
    costUsd: left.costUsd + normalized.costUsd,
  };
}

function asDbExecutor(value: unknown): DbExecutor {
  return value as DbExecutor;
}

export class ControlPlaneService {
  private readonly sql: Sql;
  private readonly config: ControlPlaneConfig;
  private readonly adapters;

  constructor(sql: Sql, config: ControlPlaneConfig, adapters?: AdapterRegistry) {
    this.sql = sql;
    this.config = config;
    this.adapters =
      adapters ??
      createAdapterRegistry({
        sql,
        encryptionKey: config.encryptionKey,
        allowedProcessCommands: config.allowedProcessCommands,
        allowedCodexCommands: config.allowedCodexCommands,
        defaultCodexCommand: config.defaultCodexCommand,
      });
  }

  async schedulerTick(now = new Date()): Promise<void> {
    const agents = await listScheduledAgents(this.sql);
    for (const agent of agents) {
      if (!isSupportedExecutionAdapter(agent.adapter_type)) continue;

      const config = asObject(agent.adapter_config);
      const schedule = parseHeartbeatSettings(config);
      if (!schedule.enabled || schedule.intervalSec <= 0) continue;

      const state = mergeRuntimeState(
        {
          consecutiveFailures: 0,
          activeWakeupRequestId: null,
        },
        agent.state_data ?? {},
      );

      if (!isHeartbeatDue(state, now)) continue;

      const payload: JsonObject = {
        task: `Scheduled heartbeat for ${agent.name}`,
        source: "scheduler",
      };

      const enqueued = await enqueueWakeup(this.sql, {
        agentId: agent.id,
        companyId: agent.company_id,
        reason: `Timer heartbeat for ${agent.name}`,
        triggerType: "timer",
        payload,
      });

      await upsertRuntimeState(
        this.sql,
        agent.id,
        agent.company_id,
        mergeRuntimeState(state, {
          activeWakeupRequestId: enqueued.wakeupRequestId,
        }),
      );
    }
  }

  async workerTick(): Promise<void> {
    while (true) {
      const wakeup = await claimNextWakeup(
        this.sql,
        this.config.workerId,
        this.config.staleClaimMs,
      );
      if (!wakeup) return;

      const context = await loadClaimedWakeupContext(this.sql, wakeup.id);
      if (!context) continue;

      try {
        await this.processWakeup(context);
      } catch (error) {
        console.error(
          `[control-plane] wakeup ${wakeup.id} failed: ${toErrorMessage(error)}`,
        );
      }
    }
  }

  private async processWakeup(context: ClaimedWakeupContext): Promise<void> {
    const adapter = this.adapters.get(context.agent.adapter_type);
    if (!adapter) {
      await this.finalizeFailure(context, null, [], normalizeUsage(), "", "", new Error(
        `Adapter ${context.agent.adapter_type} is configuration-only in M1`,
      ));
      return;
    }

    const task = summarizeTask(
      context.wakeup.payload,
      context.wakeup.reason || `Wake up ${context.agent.name}`,
    );

    const schedule = parseHeartbeatSettings(asObject(context.agent.adapter_config));
    const { runId } = await this.startWakeup(context, task);

    let totals = normalizeUsage();
    let stdoutExcerpt = "";
    let stderrExcerpt = "";
    const steps: StepRecord[] = [];
    let sensitiveValues: string[] = [];

    try {
      const resolved = await this.adapters.resolveConfig(
        context.agent.adapter_type,
        context.agent.company_id,
        asObject(context.agent.adapter_config),
      );
      sensitiveValues = resolved.sensitiveValues;

      for (const step of LOOP_STEPS) {
        await this.insertHeartbeatEvent(context, "step_started", {
          step,
          attempt: context.wakeup.attempt_count,
        });

        const execution = await adapter.executeStep({
          step,
          task,
          agent: context.agent,
          previousSteps: steps,
          rawConfig: asObject(context.agent.adapter_config),
          resolvedConfig: resolved.config,
        });

        const parsed = adapter.parseOutput(
          {
            step,
            task,
            agent: context.agent,
            previousSteps: steps,
            rawConfig: asObject(context.agent.adapter_config),
            resolvedConfig: resolved.config,
          },
          execution,
        );

        const usage = normalizeUsage(parsed.usage ?? execution.usage);
        totals = addUsage(totals, usage);
        stdoutExcerpt = execution.stdout || stdoutExcerpt;
        stderrExcerpt = execution.stderr || stderrExcerpt;

        const record: StepRecord = {
          step,
          summary: parsed.summary,
          data: parsed.data,
          usage,
          stdout: execution.stdout,
          stderr: execution.stderr,
          exitCode: execution.exitCode,
        };
        steps.push(record);

        await this.insertExecutionLog(
          context,
          runId,
          step === "execute" || step === "submit" ? "output" : "decision",
          {
            step,
            summary: parsed.summary,
            data: parsed.data,
            usage,
            stdout: execution.stdout,
            stderr: execution.stderr,
          },
          sensitiveValues,
        );

        await this.insertHeartbeatEvent(context, "step_completed", {
          step,
          summary: parsed.summary,
          usage,
        });
      }

      await this.finalizeSuccess(
        context,
        runId,
        steps,
        totals,
        stdoutExcerpt,
        stderrExcerpt,
        schedule.intervalSec,
      );
    } catch (error) {
      await this.insertHeartbeatEvent(context, "step_failed", {
        attempt: context.wakeup.attempt_count,
        error: toErrorMessage(error),
      });
      await this.insertExecutionLog(
        context,
        runId,
        "failure",
        {
          error: toErrorMessage(error),
          totals,
        },
        sensitiveValues,
      );
      await this.finalizeFailure(
        context,
        runId,
        steps,
        totals,
        stdoutExcerpt,
        stderrExcerpt,
        error,
      );
    }
  }

  private async startWakeup(
    context: ClaimedWakeupContext,
    task: string,
  ): Promise<{ runId: string }> {
    return await this.sql.begin(async (rawTx) => {
      const tx = asDbExecutor(rawTx);
      const issueId = context.wakeup.payload.issueId;
      const rows = await tx<{ id: string }[]>`
        INSERT INTO public.runs (
          company_id,
          issue_id,
          agent_id,
          status,
          summary
        )
        VALUES (
          ${context.agent.company_id}::uuid,
          ${typeof issueId === "string" ? issueId : null}::uuid,
          ${context.agent.id}::uuid,
          'running',
          ${task}
        )
        RETURNING id
      `;
      const runId = rows[0]?.id;
      if (!runId) {
        throw new Error("Failed to create run");
      }

      await tx`
        UPDATE public.agent_wakeup_requests
           SET run_id = ${runId}::uuid
         WHERE id = ${context.wakeup.id}::uuid
      `;

      if (context.wakeup.heartbeat_run_id) {
        await tx`
          UPDATE public.heartbeat_runs
             SET status = 'running',
                 started_at = now(),
                 finished_at = NULL,
                 error = NULL,
                 summary = ${task},
                 run_id = ${runId}::uuid
           WHERE id = ${context.wakeup.heartbeat_run_id}::uuid
        `;
      }

      await upsertRuntimeState(
        tx,
        context.agent.id,
        context.agent.company_id,
        mergeRuntimeState(context.runtimeState, {
          activeWakeupRequestId: context.wakeup.id,
        }),
      );

      await tx`
        UPDATE public.agents
           SET status = 'running',
               updated_at = now()
         WHERE id = ${context.agent.id}::uuid
      `;

      await tx`
        INSERT INTO public.activity_events (
          company_id,
          agent_id,
          issue_id,
          action,
          details
        )
        VALUES (
          ${context.agent.company_id}::uuid,
          ${context.agent.id}::uuid,
          ${typeof issueId === "string" ? issueId : null}::uuid,
          'run_started',
          ${task}
        )
      `;

      if (context.wakeup.heartbeat_run_id) {
        await tx`
          INSERT INTO public.heartbeat_run_events (run_id, event_type, payload)
          VALUES (
            ${context.wakeup.heartbeat_run_id}::uuid,
            'run_started',
            ${tx.json({ runId, task })}
          )
        `;
      }

      return { runId };
    });
  }

  private async insertHeartbeatEvent(
    context: ClaimedWakeupContext,
    eventType: string,
    payload: JsonObject,
  ): Promise<void> {
    if (!context.wakeup.heartbeat_run_id) return;
    await this.sql`
      INSERT INTO public.heartbeat_run_events (run_id, event_type, payload)
      VALUES (
        ${context.wakeup.heartbeat_run_id}::uuid,
        ${eventType},
        ${this.sql.json(payload)}
      )
    `;
  }

  private async insertExecutionLog(
    context: ClaimedWakeupContext,
    runId: string,
    logType: string,
    content: JsonObject,
    sensitiveValues: string[],
  ): Promise<void> {
    const redacted = redactJsonValue(toJsonValue(content), sensitiveValues);
    await this.sql`
      INSERT INTO public.agent_execution_logs (
        company_id,
        agent_id,
        run_id,
        log_type,
        content
      )
      VALUES (
        ${context.agent.company_id}::uuid,
        ${context.agent.id}::uuid,
        ${runId}::uuid,
        ${logType},
        ${this.sql.json(redacted)}
      )
    `;
  }

  private async finalizeSuccess(
    context: ClaimedWakeupContext,
    runId: string,
    steps: StepRecord[],
    totals: TokenUsage,
    stdoutExcerpt: string,
    stderrExcerpt: string,
    intervalSec: number,
  ): Promise<void> {
    const summary = steps.at(-1)?.summary ?? context.wakeup.reason ?? "Completed";
    const nowIso = new Date().toISOString();
    const nextHeartbeatAt = nextIntervalIso(intervalSec, new Date(nowIso));

    await this.sql.begin(async (rawTx) => {
      const tx = asDbExecutor(rawTx);
      await tx`
        UPDATE public.runs
           SET status = 'completed',
               summary = ${summary},
               stdout_excerpt = ${truncate(stdoutExcerpt)},
               stderr_excerpt = ${truncate(stderrExcerpt)},
               error = NULL,
               total_input_tokens = ${totals.inputTokens},
               total_output_tokens = ${totals.outputTokens},
               total_cached_input_tokens = ${totals.cachedInputTokens},
               total_cost_usd = ${totals.costUsd},
               finished_at = now()
         WHERE id = ${runId}::uuid
      `;

      await tx`
        UPDATE public.agent_wakeup_requests
           SET status = 'completed',
               resolved_at = now(),
               last_error = NULL,
               run_id = ${runId}::uuid
         WHERE id = ${context.wakeup.id}::uuid
      `;

      if (context.wakeup.heartbeat_run_id) {
        await tx`
          UPDATE public.heartbeat_runs
             SET status = 'completed',
                 finished_at = now(),
                 summary = ${summary},
                 error = NULL,
                 run_id = ${runId}::uuid,
                 total_input_tokens = ${totals.inputTokens},
                 total_output_tokens = ${totals.outputTokens},
                 total_cost_usd = ${totals.costUsd}
           WHERE id = ${context.wakeup.heartbeat_run_id}::uuid
        `;
      }

      const currentState = await loadRuntimeState(tx, context.agent.id);
      await upsertRuntimeState(
        tx,
        context.agent.id,
        context.agent.company_id,
        mergeRuntimeState(currentState, {
          lastHeartbeatAt: nowIso,
          nextHeartbeatAt,
          consecutiveFailures: 0,
          activeWakeupRequestId: null,
        }),
      );

      await tx`
        UPDATE public.agents
           SET status = 'idle',
               updated_at = now()
         WHERE id = ${context.agent.id}::uuid
      `;

      await tx`
        INSERT INTO public.activity_events (
          company_id,
          agent_id,
          issue_id,
          action,
          details
        )
        VALUES (
          ${context.agent.company_id}::uuid,
          ${context.agent.id}::uuid,
          ${typeof context.wakeup.payload.issueId === "string" ? context.wakeup.payload.issueId : null}::uuid,
          'run_completed',
          ${summary}
        )
      `;

      if (context.wakeup.heartbeat_run_id) {
        await tx`
          INSERT INTO public.heartbeat_run_events (run_id, event_type, payload)
          VALUES (
            ${context.wakeup.heartbeat_run_id}::uuid,
            'run_completed',
            ${tx.json({ runId, summary, totals })}
          )
        `;
      }
    });
  }

  private async finalizeFailure(
    context: ClaimedWakeupContext,
    runId: string | null,
    steps: StepRecord[],
    totals: TokenUsage,
    stdoutExcerpt: string,
    stderrExcerpt: string,
    error: unknown,
  ): Promise<void> {
    const message = toErrorMessage(error);
    const retry = shouldRetryWakeup(
      context.wakeup.attempt_count,
      this.config.maxAttempts,
    );
    const schedule = parseHeartbeatSettings(asObject(context.agent.adapter_config));
    const nextHeartbeatAt = retry
      ? undefined
      : nextIntervalIso(schedule.intervalSec, new Date());

    await this.sql.begin(async (rawTx) => {
      const tx = asDbExecutor(rawTx);
      if (runId) {
        await tx`
          UPDATE public.runs
             SET status = 'failed',
                 summary = ${steps.at(-1)?.summary ?? context.wakeup.reason ?? "Failed"},
                 stdout_excerpt = ${truncate(stdoutExcerpt)},
                 stderr_excerpt = ${truncate(stderrExcerpt)},
                 error = ${message},
                 total_input_tokens = ${totals.inputTokens},
                 total_output_tokens = ${totals.outputTokens},
                 total_cached_input_tokens = ${totals.cachedInputTokens},
                 total_cost_usd = ${totals.costUsd},
                 finished_at = now()
           WHERE id = ${runId}::uuid
        `;
      }

      if (retry) {
        await tx`
          UPDATE public.agent_wakeup_requests
             SET status = 'pending',
                 claimed_at = NULL,
                 claimed_by = NULL,
                 run_id = NULL,
                 last_error = ${message}
           WHERE id = ${context.wakeup.id}::uuid
        `;

        if (context.wakeup.heartbeat_run_id) {
          await tx`
            UPDATE public.heartbeat_runs
               SET status = 'pending',
                   started_at = NULL,
                   finished_at = NULL,
                   run_id = NULL,
                   error = ${message},
                   summary = ${message}
             WHERE id = ${context.wakeup.heartbeat_run_id}::uuid
          `;
        }

        const currentState = await loadRuntimeState(tx, context.agent.id);
        await upsertRuntimeState(
          tx,
          context.agent.id,
          context.agent.company_id,
          mergeRuntimeState(currentState, {
            activeWakeupRequestId: null,
          }),
        );

        await tx`
          UPDATE public.agents
             SET status = 'idle',
                 updated_at = now()
           WHERE id = ${context.agent.id}::uuid
        `;

        await tx`
          INSERT INTO public.activity_events (
            company_id,
            agent_id,
            issue_id,
            action,
            details
          )
          VALUES (
            ${context.agent.company_id}::uuid,
            ${context.agent.id}::uuid,
            ${typeof context.wakeup.payload.issueId === "string" ? context.wakeup.payload.issueId : null}::uuid,
            'run_retry_scheduled',
            ${message}
          )
        `;

        if (context.wakeup.heartbeat_run_id) {
          await tx`
            INSERT INTO public.heartbeat_run_events (run_id, event_type, payload)
            VALUES (
              ${context.wakeup.heartbeat_run_id}::uuid,
              'run_retry_scheduled',
              ${tx.json({ error: message, attempt: context.wakeup.attempt_count })}
            )
          `;
        }

        return;
      }

      await tx`
        UPDATE public.agent_wakeup_requests
           SET status = 'failed',
               resolved_at = now(),
               last_error = ${message},
               run_id = ${runId}::uuid
         WHERE id = ${context.wakeup.id}::uuid
      `;

      if (context.wakeup.heartbeat_run_id) {
        await tx`
          UPDATE public.heartbeat_runs
             SET status = 'failed',
                 finished_at = now(),
                 error = ${message},
                 summary = ${message},
                 run_id = ${runId}::uuid,
                 total_input_tokens = ${totals.inputTokens},
                 total_output_tokens = ${totals.outputTokens},
                 total_cost_usd = ${totals.costUsd}
           WHERE id = ${context.wakeup.heartbeat_run_id}::uuid
        `;
      }

      const currentState = await loadRuntimeState(tx, context.agent.id);
      await upsertRuntimeState(
        tx,
        context.agent.id,
        context.agent.company_id,
        mergeRuntimeState(currentState, {
          activeWakeupRequestId: null,
          consecutiveFailures: (currentState.consecutiveFailures ?? 0) + 1,
          nextHeartbeatAt,
        }),
      );

      await tx`
        UPDATE public.agents
           SET status = 'error',
               updated_at = now()
         WHERE id = ${context.agent.id}::uuid
      `;

      await tx`
        INSERT INTO public.activity_events (
          company_id,
          agent_id,
          issue_id,
          action,
          details
        )
        VALUES (
          ${context.agent.company_id}::uuid,
          ${context.agent.id}::uuid,
          ${typeof context.wakeup.payload.issueId === "string" ? context.wakeup.payload.issueId : null}::uuid,
          'run_failed',
          ${message}
        )
      `;

      if (context.wakeup.heartbeat_run_id) {
        await tx`
          INSERT INTO public.heartbeat_run_events (run_id, event_type, payload)
          VALUES (
            ${context.wakeup.heartbeat_run_id}::uuid,
            'run_failed',
            ${tx.json({ error: message, runId, totals })}
          )
        `;
      }
    });
  }
}
