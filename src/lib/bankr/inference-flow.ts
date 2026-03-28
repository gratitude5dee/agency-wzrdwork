/**
 * Bankr Inference Flow — Orchestrated Flow
 *
 * Provides a product- or agent-triggered Bankr inference path that:
 *   1. Loads persisted Bankr configuration for the company
 *   2. Routes inference through the BankrGateway (edge function proxy)
 *   3. Records model, token usage, and spend evidence in the runtime trail
 *      (agent_execution_logs) for full observability
 *
 * The evidence trail uses shared identifiers (company_id, agent_id, run_id)
 * so validators can trace inference activity without hidden manual correlation.
 *
 * Fulfills: VAL-BANKR-001
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import { BankrGateway } from "./gateway";
import { estimateInferenceCost } from "./wallet";
import { loadBankrConfig } from "./config";
import type { Json } from "@/integrations/supabase/types";
import type { ExecutionLogType } from "@/lib/erc8004/types";
import type { ChatMessage, BankrResponse } from "./types";

/* ================================================================
   Types
   ================================================================ */

/** Input for the Bankr inference flow */
export interface BankrInferenceInput {
  /** Company that owns this inference context */
  companyId: string;
  /** Agent triggering the inference (optional for product-triggered flows) */
  agentId?: string;
  /** Run to associate evidence with (optional) */
  runId?: string;
  /** Chat messages to send */
  messages: ChatMessage[];
  /** Model override — if omitted, uses persisted config default */
  model?: string;
  /** Sampling temperature (0–2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

/** Result of the Bankr inference flow */
export interface BankrInferenceResult {
  /** Whether the inference succeeded */
  success: boolean;
  /** The raw Bankr API response */
  response: BankrResponse | null;
  /** Model used for inference */
  model: string | null;
  /** Token usage from the inference */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
  /** Estimated cost in cUSD */
  estimatedCostCusd: string | null;
  /** Error message if the flow failed */
  error?: string;
  /** Log ID of the evidence entry */
  evidenceLogId?: string;
}

/* ================================================================
   Evidence recording helpers
   ================================================================ */

/**
 * Record a Bankr evidence entry in agent_execution_logs.
 *
 * When an agentId is available, uses the structured logExecution helper.
 * Otherwise, inserts directly for product-triggered (non-agent) flows.
 */
async function recordBankrEvidence(
  companyId: string,
  agentId: string | undefined,
  runId: string | undefined,
  logType: ExecutionLogType,
  content: Record<string, unknown>,
): Promise<string | null> {
  try {
    if (agentId) {
      const logRow = await logExecution(
        agentId,
        companyId,
        runId ?? null,
        logType,
        content,
      );
      return logRow?.id ?? null;
    }

    // Product-triggered flow: insert directly with a sentinel agent_id
    const { data, error } = await supabase
      .from("agent_execution_logs")
      .insert({
        agent_id: agentId ?? "00000000-0000-0000-0000-000000000000",
        company_id: companyId,
        run_id: runId ?? null,
        log_type: logType,
        content: content as unknown as Json,
      })
      .select("id")
      .single();

    if (error || !data) return null;
    return data.id;
  } catch {
    // Evidence recording should not break the flow
    return null;
  }
}

/**
 * Record a Bankr event as an activity_events entry for the company.
 */
async function recordActivityEvent(
  companyId: string,
  agentId: string | undefined,
  action: string,
  details: string,
): Promise<void> {
  await supabase.from("activity_events").insert({
    company_id: companyId,
    agent_id: agentId ?? null,
    action,
    details,
  });
}

/* ================================================================
   Inference Flow
   ================================================================ */

/**
 * Execute a Bankr-routed inference flow with spend evidence recording.
 *
 * 1. Loads the company's Bankr config (or uses explicit model)
 * 2. Routes inference through BankrGateway (Supabase edge function proxy)
 * 3. Records model, token usage, and spend trace as evidence
 *
 * @param input - The flow input parameters
 * @returns Inference result with spend trace evidence
 */
export async function executeBankrInference(
  input: BankrInferenceInput,
): Promise<BankrInferenceResult> {
  const { companyId, agentId, runId, messages } = input;

  // 1. Resolve model from config or explicit override
  let model = input.model;
  if (!model) {
    const config = await loadBankrConfig(companyId);
    if (!config.configured || !config.defaultModel) {
      const error = "Bankr not configured: no default model selected for this company";
      await recordBankrEvidence(companyId, agentId, runId, "failure", {
        action: "bankr_inference_failed",
        error,
        integration: "bankr",
      });
      return {
        success: false,
        response: null,
        model: null,
        usage: null,
        estimatedCostCusd: null,
        error,
      };
    }
    model = config.defaultModel;
  }

  // 2. Route inference through the BankrGateway
  const gateway = new BankrGateway();
  let response: BankrResponse;

  try {
    response = await gateway.routeInference(model, messages, {
      temperature: input.temperature,
      max_tokens: input.maxTokens,
    });
  } catch (err) {
    const error = `Bankr inference failed: ${err instanceof Error ? err.message : String(err)}`;
    await recordBankrEvidence(companyId, agentId, runId, "failure", {
      action: "bankr_inference_failed",
      error,
      integration: "bankr",
      model,
    });
    return {
      success: false,
      response: null,
      model,
      usage: null,
      estimatedCostCusd: null,
      error,
    };
  }

  // 3. Calculate spend trace
  const usage = response.usage;
  const estimatedCostCusd = estimateInferenceCost(
    model,
    usage.total_tokens,
  );

  // 4. Record inference + spend evidence
  const evidenceLogId = await recordBankrEvidence(
    companyId,
    agentId,
    runId,
    "output",
    {
      action: "bankr_inference",
      integration: "bankr",
      model,
      responseId: response.id,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      estimatedCostCusd,
      finishReason: response.choices[0]?.finish_reason ?? null,
      messageCount: messages.length,
    },
  );

  await recordActivityEvent(
    companyId,
    agentId,
    "bankr_inference",
    `Bankr inference: model=${model}, tokens=${usage.total_tokens}, est_cost=${estimatedCostCusd} cUSD`,
  );

  return {
    success: true,
    response,
    model,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
    estimatedCostCusd,
    evidenceLogId: evidenceLogId ?? undefined,
  };
}
