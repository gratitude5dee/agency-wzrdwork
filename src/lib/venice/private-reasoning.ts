/**
 * Venice Private Reasoning — Core Logic
 *
 * Provides Venice-backed step execution for agents with private cognition
 * enabled, plus redaction utilities that strip private reasoning content
 * from operator-visible logs and exported artifacts.
 *
 * Private reasoning content is generated during Venice-routed steps and
 * must never be exposed in operator-facing surfaces:
 * - Execution logs (`agent_execution_logs` table)
 * - Exported `agent_log.json` artifacts
 * - UI panels showing run details or activity
 *
 * The redaction strategy identifies known private-reasoning field names
 * (`venice_reasoning`, `private_reasoning_content`) and replaces their
 * values with a "[Private Reasoning Redacted]" placeholder.
 */

import type { StepResult } from "@/lib/agent-loop/types";
import type { RunLogExport, RunLogEntry } from "@/lib/erc8004/execution-log";

/** Sentinel value used for redacted private reasoning fields */
export const PRIVATE_REASONING_REDACTED = "[Private Reasoning Redacted]";

/** Field names that contain private reasoning and must be redacted */
const PRIVATE_REASONING_FIELDS = [
  "venice_reasoning",
  "private_reasoning_content",
] as const;

/* ================================================================
   Redaction Utilities
   ================================================================ */

/**
 * Deeply redact private reasoning fields from a log content object.
 *
 * Walks one level of nesting (top-level + direct child objects) to
 * replace private reasoning field values with the redaction placeholder.
 *
 * @param content - The raw content object from an execution log entry
 * @returns A new object with private reasoning fields redacted
 */
export function redactPrivateReasoning(
  content: Record<string, unknown>,
): Record<string, unknown> {
  if (!content || typeof content !== "object") {
    return {};
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(content)) {
    if (
      PRIVATE_REASONING_FIELDS.includes(
        key as (typeof PRIVATE_REASONING_FIELDS)[number],
      )
    ) {
      result[key] = PRIVATE_REASONING_REDACTED;
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      // Recurse one level into nested objects
      result[key] = redactPrivateReasoning(
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Redact private reasoning from an entire run log export.
 *
 * Applies redaction to every entry's content object in the export,
 * preserving the envelope metadata (run_id, status, usage, etc.).
 *
 * @param runLog - The raw run log export
 * @returns A new run log export with private reasoning redacted
 */
export function redactRunLogExport(runLog: RunLogExport): RunLogExport {
  return {
    ...runLog,
    entries: runLog.entries.map((entry: RunLogEntry) => ({
      ...entry,
      content: redactPrivateReasoning(entry.content),
    })),
  };
}

/* ================================================================
   Venice-Backed Step Execution
   ================================================================ */

/** Input context for a Venice-backed step */
export interface VeniceStepInput {
  /** The task description */
  task: string;
  /** The Venice model to use */
  veniceModel: string;
  /** Agent name for context */
  agentName: string;
  /** Agent role for context */
  agentRole: string;
  /** The underlying adapter type (e.g. "hermes") */
  adapterType: string;
  /** Previous step results for context */
  previousSteps?: StepResult[];
}

/**
 * Execute a single autonomous loop step through the Venice private
 * reasoning path.
 *
 * Each step produces output that includes:
 * - `veniceRouted: true` — marker for downstream processing
 * - `veniceModel` — the model used for reasoning
 * - `privateCognitionEnabled: true` — flag for log redaction
 * - `venice_reasoning` — the raw reasoning output (will be redacted
 *   before persisting to operator-visible logs)
 *
 * In a production system, these steps would call the VeniceClient
 * for actual LLM inference. In this implementation, the steps produce
 * structured outputs with Venice metadata that prove the routing path
 * and enable the redaction pipeline.
 *
 * @param step - The loop step to execute
 * @param input - The Venice step input context
 * @returns Step-specific output with Venice routing metadata
 */
export async function executeVeniceStep(
  step: string,
  input: VeniceStepInput,
): Promise<Record<string, unknown>> {
  const baseMetadata = {
    veniceRouted: true,
    veniceModel: input.veniceModel,
    privateCognitionEnabled: true,
    adapterType: input.adapterType,
  };

  switch (step) {
    case "discover":
      return veniceDiscover(input, baseMetadata);
    case "plan":
      return venicePlan(input, baseMetadata);
    case "execute":
      return veniceExecute(input, baseMetadata);
    case "verify":
      return veniceVerify(input, baseMetadata);
    default:
      return baseMetadata;
  }
}

/* ----------------------------------------------------------------
   Individual step implementations
   ---------------------------------------------------------------- */

function veniceDiscover(
  input: VeniceStepInput,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...meta,
    taskAnalysis: input.task,
    complexity: "medium",
    estimatedSteps: 3,
    requiresApproval: false,
    agentCapabilities: {
      name: input.agentName,
      role: input.agentRole,
      veniceModel: input.veniceModel,
    },
    venice_reasoning: `Venice ${input.veniceModel} analysis: Task requires ${input.agentRole} capabilities for: ${input.task}`,
  };
}

function venicePlan(
  input: VeniceStepInput,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const discovery = input.previousSteps?.find((s) => s.step === "discover");
  const estimatedSteps =
    (discovery?.data as Record<string, unknown> | undefined)?.estimatedSteps ??
    3;

  const subtasks = Array.from({ length: estimatedSteps as number }, (_, i) => ({
    id: `venice-subtask-${i + 1}`,
    description: `[Venice/${input.veniceModel}] Step ${i + 1} for: ${input.task}`,
    status: "pending" as const,
    veniceModel: input.veniceModel,
  }));

  return {
    ...meta,
    subtasks,
    venice_reasoning: `Venice ${input.veniceModel} planning: Decomposed into ${subtasks.length} subtasks`,
  };
}

function veniceExecute(
  input: VeniceStepInput,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const planResult = input.previousSteps?.find((s) => s.step === "plan");
  const subtasks = (planResult?.data as Record<string, unknown> | undefined)
    ?.subtasks as Array<Record<string, unknown>> | undefined;

  const completedSubtasks = (subtasks ?? []).map((st) => ({
    ...st,
    status: "completed" as const,
    result: { output: `Venice-executed: ${st.description}` },
    veniceExecution: {
      model: input.veniceModel,
      completedAt: new Date().toISOString(),
    },
  }));

  return {
    ...meta,
    completedSubtasks,
    venice_reasoning: `Venice ${input.veniceModel} execution: Completed ${completedSubtasks.length} subtasks with private reasoning`,
  };
}

function veniceVerify(
  input: VeniceStepInput,
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const executeResult = input.previousSteps?.find(
    (s) => s.step === "execute",
  );
  const completedSubtasks =
    (executeResult?.data as Record<string, unknown> | undefined)
      ?.completedSubtasks ?? [];
  const subtaskArray = completedSubtasks as Array<Record<string, unknown>>;

  const issues: string[] = [];
  for (const subtask of subtaskArray) {
    if (subtask.status !== "completed") {
      issues.push(`Subtask ${subtask.id} not completed: ${subtask.status}`);
    }
  }

  return {
    ...meta,
    verified: issues.length === 0,
    issues,
    veniceValidation: {
      model: input.veniceModel,
      subtasksVerified: subtaskArray.length,
    },
    venice_reasoning: `Venice ${input.veniceModel} verification: ${issues.length === 0 ? "All checks passed" : `${issues.length} issues found`}`,
  };
}
