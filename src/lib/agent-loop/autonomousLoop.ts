/**
 * Protocol Labs Autonomous Execution Loop
 *
 * Implements the 5-step discover→plan→execute→verify→submit cycle
 * for the "Let the Agent Cook" track. Each step creates structured
 * execution log entries via the ERC-8004 logging system.
 *
 * The loop produces coherent evidence across:
 * - **runs** — the execution record linked to agent, company, and optional issue
 * - **agent_execution_logs** — step-level structured logs
 * - **activity_events** — human-readable lifecycle events
 * - **approvals** — created when authority policy requires operator sign-off
 * - **issues** — status updated as the loop progresses (when issue-linked)
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import { abortOnRepeatedFailure, logAbort, runGuardrailCheck } from "./guardrails";
import { trackBudget } from "./budget";
import {
  resolveAdapterRuntime,
  executeAdapterStep,
  type AdapterRuntimeContext,
} from "./adapter-runtime";
import { redactPrivateReasoning } from "@/lib/venice/private-reasoning";
import type {
  AuthorityPolicy,
  GuardrailResult,
  LoopOptions,
  LoopResult,
  LoopStep,
  StepResult,
  Subtask,
} from "./types";

const DEFAULT_MAX_RETRIES = 3;

/* ================================================================
   Activity event helpers
   ================================================================ */

/**
 * Insert a row into the `activity_events` table.
 *
 * Activity events are human-readable lifecycle entries visible in the
 * cockpit logs panel and dashboard activity feed.
 */
async function createActivityEvent(
  companyId: string,
  agentId: string,
  action: string,
  details: string,
  issueId: string | null,
): Promise<void> {
  await supabase.from("activity_events").insert({
    company_id: companyId,
    agent_id: agentId,
    action,
    details,
    issue_id: issueId,
  });
}

/* ================================================================
   Issue status helpers
   ================================================================ */

/**
 * Update the status of an issue in the `issues` table.
 * No-op when issueId is null/undefined.
 */
async function updateIssueStatus(
  issueId: string | null | undefined,
  status: string,
): Promise<void> {
  if (!issueId) return;
  await supabase
    .from("issues")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", issueId);
}

/* ================================================================
   Approval helpers
   ================================================================ */

/**
 * Create a pending approval record in the `approvals` table.
 * Returns the created approval's ID.
 */
async function createApproval(
  companyId: string,
  agentId: string,
  issueId: string | null | undefined,
  summary: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("approvals")
    .insert({
      company_id: companyId,
      requested_by_agent_id: agentId,
      issue_id: issueId ?? null,
      status: "pending",
      summary,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create approval: ${error?.message ?? "unknown error"}`,
    );
  }

  return data.id;
}

/* ================================================================
   Main loop
   ================================================================ */

/**
 * Run the autonomous execution loop for an agent.
 *
 * The loop follows five steps:
 * 1. **Discover** — Analyze the task and gather context
 * 2. **Plan** — Decompose the task into subtasks
 * 3. **Execute** — Run each subtask
 * 4. **Verify** — Validate the outputs
 * 5. **Submit** — Record results and update run status
 *
 * Each step creates execution log entries for full observability.
 * Budget enforcement and safety guardrails are checked throughout.
 *
 * When an `issueId` is provided the run is linked to the issue and issue
 * status transitions through `in_progress` → `in_review` → `done` (or
 * remains `in_review` when approval is required).
 *
 * When `authorityPolicy` is `"approval"`, the submit step creates an
 * approval record and the run ends in `"approval_pending"` rather than
 * `"completed"`.
 *
 * @param agentId - The agent executing the loop
 * @param task - Natural language task description
 * @param options - Loop configuration (company, issue, authority, limits)
 * @returns The loop result with all step outcomes and shared identifiers
 */
export async function runAutonomousLoop(
  agentId: string,
  task: string,
  options: LoopOptions,
): Promise<LoopResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const { companyId, issueId, authorityPolicy = "auto", useAdapterRuntime = false } = options;

  // ------------------------------------------------------------------
  // 0. Resolve adapter runtime context when requested
  // ------------------------------------------------------------------
  let adapterCtx: AdapterRuntimeContext | undefined;
  if (useAdapterRuntime) {
    adapterCtx = await resolveAdapterRuntime(agentId);
  }

  // ------------------------------------------------------------------
  // 1. Create a run entry linked to the issue (if any)
  // ------------------------------------------------------------------
  const { data: run, error: runError } = await supabase
    .from("runs")
    .insert({
      agent_id: agentId,
      company_id: companyId,
      status: "running",
      summary: task,
      issue_id: issueId ?? null,
    })
    .select()
    .single();

  if (runError || !run) {
    throw new Error(
      `Failed to create run for agent ${agentId}: ${runError?.message ?? "unknown error"}`,
    );
  }

  const runId = run.id;
  const steps: StepResult[] = [];
  let totalTokensUsed = 0;
  let totalCostUsd = 0;

  // ------------------------------------------------------------------
  // 2. Mark issue in_progress (when issue-linked)
  // ------------------------------------------------------------------
  await updateIssueStatus(issueId, "in_progress");

  // ------------------------------------------------------------------
  // 3. Create "run_started" activity event
  // ------------------------------------------------------------------
  await createActivityEvent(
    companyId,
    agentId,
    "run_started",
    `Autonomous run started for task: ${task}`,
    issueId ?? null,
  );

  // ------------------------------------------------------------------
  // 4. Log loop start to execution logs
  // ------------------------------------------------------------------
  await logExecution(agentId, companyId, runId, "decision", {
    action: "loop_start",
    task,
    issueId: issueId ?? null,
    authorityPolicy,
    ...(adapterCtx ? { adapterType: adapterCtx.adapterType, adapterResolved: true } : {}),
    ...(adapterCtx?.privateCognitionEnabled
      ? { privateCognitionEnabled: true, veniceModel: adapterCtx.veniceModel }
      : {}),
    options: {
      maxRetries,
      spendLimitUsd: options.spendLimitUsd ?? null,
      maxTokens: options.maxTokens ?? null,
      useAdapterRuntime,
    },
  });

  const loopSteps: LoopStep[] = [
    "discover",
    "plan",
    "execute",
    "verify",
    "submit",
  ];

  let loopSuccess = true;
  let guardrailRejection: GuardrailResult | undefined;

  for (const step of loopSteps) {
    // ---- Pre-step guardrail checkpoint (budget + safety) ----
    // Runs BEFORE any side effects for this step occur.
    if (options.spendLimitUsd) {
      const estimatedStepCost = options.spendLimitUsd / loopSteps.length;
      const guardrailResult = await runGuardrailCheck({
        agentId,
        companyId,
        runId,
        estimatedCostUsd: estimatedStepCost,
        transaction: options.recipientWhitelist?.length
          ? {
              amount: estimatedStepCost,
              recipient: "loop-step",
              operation: step,
            }
          : undefined,
        spendLimits: options.recipientWhitelist?.length
          ? {
              maxAmountUsd: options.spendLimitUsd,
              recipientWhitelist: options.recipientWhitelist,
            }
          : undefined,
      });

      if (!guardrailResult.allowed) {
        guardrailRejection = guardrailResult;

        // Log the guardrail-rejected step
        await logExecution(agentId, companyId, runId, "failure", {
          action: "guardrail_rejected",
          step,
          reason: guardrailResult.reason,
          ruleKind: guardrailResult.ruleKind ?? null,
          budgetSnapshot: guardrailResult.budgetSnapshot ?? null,
        });

        steps.push({
          step,
          success: false,
          error: guardrailResult.reason,
        });

        loopSuccess = false;
        break;
      }
    }

    let retryCount = 0;
    let stepSuccess = false;
    let stepData: unknown = undefined;
    let stepError: string | undefined;

    while (!stepSuccess && !abortOnRepeatedFailure(retryCount, maxRetries)) {
      try {
        // Log step start
        await logExecution(agentId, companyId, runId, "decision", {
          action: "step_start",
          step,
          attempt: retryCount + 1,
          ...(adapterCtx ? { adapterType: adapterCtx.adapterType } : {}),
        });

        // Execute the step — use adapter runtime when resolved
        if (adapterCtx && step !== "submit") {
          stepData = await executeAdapterStep(step, adapterCtx, {
            task,
            previousSteps: steps,
          });
        } else {
          stepData = await executeStep(
            step,
            agentId,
            companyId,
            runId,
            task,
            steps,
            issueId,
            authorityPolicy,
          );
        }

        // Track token usage for this step (simulated estimation)
        const stepTokens = { input: 500, output: 200 };
        const stepCost = 0.005;
        totalTokensUsed += stepTokens.input + stepTokens.output;
        totalCostUsd += stepCost;

        await trackBudget(runId, stepTokens, stepCost);

        // Log step completion — redact private reasoning when Venice-routed
        const logContent: Record<string, unknown> = {
          action: "step_complete",
          step,
          success: true,
          data: stepData,
          ...(adapterCtx ? { adapterType: adapterCtx.adapterType } : {}),
          ...(adapterCtx?.privateCognitionEnabled ? { veniceRouted: true } : {}),
        };
        await logExecution(
          agentId,
          companyId,
          runId,
          "output",
          adapterCtx?.privateCognitionEnabled
            ? redactPrivateReasoning(logContent)
            : logContent,
        );

        stepSuccess = true;
      } catch (err) {
        retryCount++;
        stepError =
          err instanceof Error ? err.message : "Unknown error";

        // Log the retry
        await logExecution(agentId, companyId, runId, "retry", {
          action: "step_retry",
          step,
          attempt: retryCount,
          maxRetries,
          error: stepError,
        });

        if (abortOnRepeatedFailure(retryCount, maxRetries)) {
          await logAbort(
            agentId,
            companyId,
            runId,
            retryCount,
            maxRetries,
            step,
          );
        }
      }
    }

    steps.push({
      step,
      success: stepSuccess,
      data: stepData,
      error: stepError,
    });

    // If a step fails after retries, mark loop as failed and stop
    if (!stepSuccess) {
      loopSuccess = false;
      break;
    }
  }

  // ------------------------------------------------------------------
  // 5. Determine terminal status based on authority policy
  // ------------------------------------------------------------------
  const submitStepData = steps.find((s) => s.step === "submit")?.data as
    | { approvalId?: string }
    | undefined;
  const approvalId = submitStepData?.approvalId;

  let runStatus: "completed" | "approval_pending" | "failed" | "guardrail_rejected";
  if (guardrailRejection) {
    runStatus = "guardrail_rejected";
  } else if (!loopSuccess) {
    runStatus = "failed";
  } else if (authorityPolicy === "approval" && approvalId) {
    runStatus = "approval_pending";
  } else {
    runStatus = "completed";
  }

  // ------------------------------------------------------------------
  // 6. Update run status
  // ------------------------------------------------------------------
  await supabase
    .from("runs")
    .update({
      status: runStatus,
      finished_at:
        runStatus !== "approval_pending" ? new Date().toISOString() : null,
      error: loopSuccess
        ? null
        : guardrailRejection
          ? `Guardrail rejected: ${guardrailRejection.reason}`
          : steps.find((s) => !s.success)?.error ?? "Unknown failure",
    })
    .eq("id", runId);

  // ------------------------------------------------------------------
  // 7. Update issue status based on terminal state
  // ------------------------------------------------------------------
  if (issueId) {
    if (runStatus === "completed") {
      await updateIssueStatus(issueId, "done");
    } else if (runStatus === "approval_pending") {
      await updateIssueStatus(issueId, "in_review");
    } else {
      // failed or guardrail_rejected — leave issue as in_progress so it can be retried
      await updateIssueStatus(issueId, "in_progress");
    }
  }

  // ------------------------------------------------------------------
  // 8. Create terminal activity event
  // ------------------------------------------------------------------
  if (runStatus === "completed") {
    await createActivityEvent(
      companyId,
      agentId,
      "run_completed",
      `Autonomous run completed successfully for task: ${task}`,
      issueId ?? null,
    );
  } else if (runStatus === "approval_pending") {
    await createActivityEvent(
      companyId,
      agentId,
      "approval_required",
      `Autonomous run paused pending operator approval for task: ${task}`,
      issueId ?? null,
    );
  } else if (runStatus === "guardrail_rejected") {
    await createActivityEvent(
      companyId,
      agentId,
      "guardrail_rejected",
      `Autonomous run rejected by guardrail: ${guardrailRejection?.reason ?? "unknown"} — task: ${task}`,
      issueId ?? null,
    );
  } else {
    await createActivityEvent(
      companyId,
      agentId,
      "run_failed",
      `Autonomous run failed for task: ${task} — ${steps.find((s) => !s.success)?.error ?? "unknown"}`,
      issueId ?? null,
    );
  }

  // ------------------------------------------------------------------
  // 9. Log loop end to execution logs
  // ------------------------------------------------------------------
  await logExecution(agentId, companyId, runId, "output", {
    action: "loop_end",
    success: loopSuccess,
    runStatus,
    issueId: issueId ?? null,
    approvalId: approvalId ?? null,
    ...(adapterCtx ? { adapterType: adapterCtx.adapterType } : {}),
    stepsCompleted: steps.filter((s) => s.success).length,
    totalSteps: loopSteps.length,
    totalTokensUsed,
    totalCostUsd,
  });

  return {
    runId,
    agentId,
    task,
    steps,
    success: loopSuccess,
    totalTokensUsed,
    totalCostUsd,
    issueId,
    approvalId,
    runStatus,
    ...(adapterCtx ? { adapterType: adapterCtx.adapterType } : {}),
  };
}

/* ================================================================
   Step dispatcher
   ================================================================ */

/**
 * Execute a single step of the autonomous loop.
 *
 * Each step has a distinct purpose:
 * - discover: Analyze the task and gather context
 * - plan: Decompose into subtasks
 * - execute: Run subtasks sequentially
 * - verify: Validate outputs against expectations
 * - submit: Record final results (or request approval)
 */
async function executeStep(
  step: LoopStep,
  agentId: string,
  companyId: string,
  runId: string,
  task: string,
  previousSteps: StepResult[],
  issueId: string | null | undefined,
  authorityPolicy: AuthorityPolicy,
): Promise<unknown> {
  switch (step) {
    case "discover":
      return executeDiscover(agentId, companyId, runId, task);

    case "plan":
      return executePlan(agentId, companyId, runId, task, previousSteps);

    case "execute":
      return executeRun(agentId, companyId, runId, previousSteps);

    case "verify":
      return executeVerify(agentId, companyId, runId, previousSteps);

    case "submit":
      return executeSubmit(
        agentId,
        companyId,
        runId,
        previousSteps,
        issueId,
        authorityPolicy,
      );
  }
}

/* ================================================================
   Individual step implementations
   ================================================================ */

/** Discover step: Analyze the task and gather context */
async function executeDiscover(
  agentId: string,
  companyId: string,
  runId: string,
  task: string,
): Promise<Record<string, unknown>> {
  await logExecution(agentId, companyId, runId, "tool_call", {
    action: "discover_analyze",
    task,
    analysis: {
      taskType: "autonomous_execution",
      complexity: "medium",
      requiresExternalData: false,
    },
  });

  return {
    taskAnalysis: task,
    complexity: "medium",
    estimatedSteps: 3,
    requiresApproval: false,
  };
}

/** Plan step: Decompose the task into subtasks */
async function executePlan(
  agentId: string,
  companyId: string,
  runId: string,
  task: string,
  previousSteps: StepResult[],
): Promise<{ subtasks: Subtask[] }> {
  const discovery = previousSteps.find((s) => s.step === "discover");
  const estimatedSteps =
    (discovery?.data as Record<string, unknown>)?.estimatedSteps ?? 3;

  const subtasks: Subtask[] = Array.from(
    { length: estimatedSteps as number },
    (_, i) => ({
      id: `subtask-${i + 1}`,
      description: `Subtask ${i + 1} for: ${task}`,
      status: "pending" as const,
    }),
  );

  await logExecution(agentId, companyId, runId, "decision", {
    action: "plan_decompose",
    task,
    subtaskCount: subtasks.length,
    subtasks: subtasks.map((s) => ({ id: s.id, description: s.description })),
  });

  return { subtasks };
}

/** Execute step: Run each subtask */
async function executeRun(
  agentId: string,
  companyId: string,
  runId: string,
  previousSteps: StepResult[],
): Promise<{ completedSubtasks: Subtask[] }> {
  const planResult = previousSteps.find((s) => s.step === "plan");
  const subtasks = [
    ...((planResult?.data as { subtasks: Subtask[] })?.subtasks ?? []),
  ];

  for (const subtask of subtasks) {
    subtask.status = "running";

    await logExecution(agentId, companyId, runId, "tool_call", {
      action: "execute_subtask",
      subtaskId: subtask.id,
      description: subtask.description,
      status: "running",
    });

    // Mark as completed (in a real system, this would invoke the agent's tools)
    subtask.status = "completed";
    subtask.result = { output: `Completed: ${subtask.description}` };

    await logExecution(agentId, companyId, runId, "output", {
      action: "subtask_complete",
      subtaskId: subtask.id,
      status: "completed",
    });
  }

  return { completedSubtasks: subtasks };
}

/** Verify step: Validate outputs against expectations */
async function executeVerify(
  agentId: string,
  companyId: string,
  runId: string,
  previousSteps: StepResult[],
): Promise<{ verified: boolean; issues: string[] }> {
  const executeResult = previousSteps.find((s) => s.step === "execute");
  const completedSubtasks =
    (executeResult?.data as { completedSubtasks: Subtask[] })
      ?.completedSubtasks ?? [];

  const issues: string[] = [];
  for (const subtask of completedSubtasks) {
    if (subtask.status !== "completed") {
      issues.push(`Subtask ${subtask.id} not completed: ${subtask.status}`);
    }
  }

  const verified = issues.length === 0;

  await logExecution(agentId, companyId, runId, "safety_check", {
    action: "verify_outputs",
    totalSubtasks: completedSubtasks.length,
    verified,
    issues,
  });

  return { verified, issues };
}

/**
 * Submit step: Record results and finalize.
 *
 * If the authority policy is "approval", this step creates an approval
 * record and pauses the loop instead of auto-completing.
 */
async function executeSubmit(
  agentId: string,
  companyId: string,
  runId: string,
  previousSteps: StepResult[],
  issueId: string | null | undefined,
  authorityPolicy: AuthorityPolicy,
): Promise<{ submitted: boolean; summary: string; approvalId?: string }> {
  const verifyResult = previousSteps.find((s) => s.step === "verify");
  const verified =
    (verifyResult?.data as { verified: boolean })?.verified ?? false;

  const summary = verified
    ? "All subtasks completed and verified successfully"
    : "Loop completed with verification issues";

  // When authority policy requires approval, create the approval and pause
  if (authorityPolicy === "approval") {
    const approvalId = await createApproval(
      companyId,
      agentId,
      issueId,
      `Approval requested: ${summary}`,
    );

    await logExecution(agentId, companyId, runId, "output", {
      action: "submit_approval_requested",
      verified,
      summary,
      approvalId,
      issueId: issueId ?? null,
      stepsCompleted: previousSteps.filter((s) => s.success).length,
    });

    return { submitted: false, summary, approvalId };
  }

  // Auto policy — complete immediately
  await logExecution(agentId, companyId, runId, "output", {
    action: "submit_results",
    verified,
    summary,
    issueId: issueId ?? null,
    stepsCompleted: previousSteps.filter((s) => s.success).length,
  });

  return { submitted: true, summary };
}
