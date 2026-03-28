/**
 * OpenServ Workflow Registration — Orchestrated Flow
 *
 * Provides a product- or agent-triggered OpenServ workflow registration
 * path that:
 *   1. Loads persisted OpenServ configuration for the company
 *   2. Resolves the agent's ERC-8004 identity for the registration
 *   3. Records the x402 service registration tied to agent identity
 *      in the runtime trail (agent_execution_logs) for full observability
 *
 * The evidence trail uses shared identifiers (company_id, agent_id, run_id)
 * so validators can trace OpenServ registration without hidden manual correlation.
 *
 * Fulfills: VAL-OPENSERV-001
 */

import { supabase } from "@/integrations/supabase/client";
import { logExecution } from "@/lib/erc8004/execution-log";
import { loadOpenServConfig } from "./config";
import type { Json } from "@/integrations/supabase/types";
import type { ExecutionLogType } from "@/lib/erc8004/types";
import type { OpenServWorkflowType } from "./config";

/* ================================================================
   Types
   ================================================================ */

/** Input for the OpenServ workflow registration flow */
export interface OpenServRegistrationInput {
  /** Company that owns this registration context */
  companyId: string;
  /** Agent whose identity is tied to the registration */
  agentId: string;
  /** Run to associate evidence with (optional) */
  runId?: string;
  /** Service name override — if omitted, uses persisted config */
  serviceName?: string;
  /** Service endpoint override */
  serviceEndpoint?: string;
  /** Workflow type override */
  workflowType?: OpenServWorkflowType;
  /** x402 pricing (USDC per request) for the service */
  pricingUsdc?: number;
}

/** A registered OpenServ workflow/service */
export interface OpenServRegistration {
  /** Registration ID (deterministic from agent + service) */
  registrationId: string;
  /** Service name */
  serviceName: string;
  /** Service endpoint */
  serviceEndpoint: string | null;
  /** Workflow type */
  workflowType: OpenServWorkflowType;
  /** Agent identity data used for the registration */
  agentIdentity: {
    agentId: string;
    operatorWallet: string | null;
    erc8004Identity: string | null;
    name: string | null;
  };
  /** x402 pricing */
  pricingUsdc: number;
  /** Registration timestamp */
  registeredAt: string;
}

/** Result of the OpenServ workflow registration flow */
export interface OpenServRegistrationResult {
  /** Whether the registration flow succeeded */
  success: boolean;
  /** The registration record */
  registration: OpenServRegistration | null;
  /** Error message if the flow failed */
  error?: string;
  /** Log ID of the evidence entry */
  evidenceLogId?: string;
}

/* ================================================================
   Evidence recording helpers
   ================================================================ */

/**
 * Record an OpenServ evidence entry in agent_execution_logs.
 */
async function recordOpenServEvidence(
  companyId: string,
  agentId: string,
  runId: string | undefined,
  logType: ExecutionLogType,
  content: Record<string, unknown>,
): Promise<string | null> {
  try {
    const logRow = await logExecution(
      agentId,
      companyId,
      runId ?? null,
      logType,
      content,
    );
    return logRow?.id ?? null;
  } catch {
    // Evidence recording should not break the flow
    return null;
  }
}

/**
 * Record an OpenServ event as an activity_events entry for the company.
 */
async function recordActivityEvent(
  companyId: string,
  agentId: string,
  action: string,
  details: string,
): Promise<void> {
  await supabase.from("activity_events").insert({
    company_id: companyId,
    agent_id: agentId,
    action,
    details,
  });
}

/* ================================================================
   Agent identity resolution
   ================================================================ */

/**
 * Resolve the agent's ERC-8004 identity for registration.
 * Returns the identity data or null if not found.
 */
async function resolveAgentIdentity(
  agentId: string,
): Promise<{
  operatorWallet: string | null;
  erc8004Identity: string | null;
  agentName: string | null;
} | null> {
  // Try agent_identities table
  const { data: identity } = await supabase
    .from("agent_identities")
    .select("operator_wallet, manifest")
    .eq("agent_id", agentId)
    .maybeSingle();

  // Also get agent name
  const { data: agent } = await supabase
    .from("agents")
    .select("name")
    .eq("id", agentId)
    .maybeSingle();

  if (!identity) {
    return {
      operatorWallet: null,
      erc8004Identity: null,
      agentName: agent?.name ?? null,
    };
  }

  const manifest = identity.manifest as Record<string, unknown> | null;
  const erc8004Identity =
    (manifest?.erc8004_identity as string) ?? null;

  return {
    operatorWallet: identity.operator_wallet,
    erc8004Identity,
    agentName: agent?.name ?? null,
  };
}

/* ================================================================
   Registration Flow
   ================================================================ */

/**
 * Execute an OpenServ workflow registration flow tied to agent identity.
 *
 * 1. Loads the company's OpenServ config (or uses explicit overrides)
 * 2. Resolves the agent's ERC-8004 identity for registration
 * 3. Creates a registration record and records evidence
 *
 * @param input - The flow input parameters
 * @returns Registration result with identity-linked evidence
 */
export async function executeOpenServRegistration(
  input: OpenServRegistrationInput,
): Promise<OpenServRegistrationResult> {
  const { companyId, agentId, runId } = input;

  // 1. Resolve OpenServ config
  const config = await loadOpenServConfig(companyId);
  const serviceName = input.serviceName ?? config.serviceName;

  if (!serviceName) {
    const error = "OpenServ not configured: no service name specified";
    await recordOpenServEvidence(companyId, agentId, runId, "failure", {
      action: "openserv_registration_failed",
      error,
      integration: "openserv",
    });
    return {
      success: false,
      registration: null,
      error,
    };
  }

  // 2. Resolve agent identity
  const identity = await resolveAgentIdentity(agentId);
  if (!identity) {
    const error = "OpenServ registration failed: could not resolve agent identity";
    await recordOpenServEvidence(companyId, agentId, runId, "failure", {
      action: "openserv_registration_failed",
      error,
      integration: "openserv",
      agentId,
    });
    return {
      success: false,
      registration: null,
      error,
    };
  }

  // 3. Build registration
  const workflowType: OpenServWorkflowType =
    input.workflowType ?? config.workflowType ?? "task";
  const serviceEndpoint =
    input.serviceEndpoint ?? config.serviceEndpoint ?? null;
  const pricingUsdc = input.pricingUsdc ?? 0.01;
  const registeredAt = new Date().toISOString();

  // Deterministic registration ID from agent + service
  const registrationId = `openserv-${agentId.substring(0, 8)}-${serviceName.replace(/\s+/g, "-").toLowerCase()}`;

  const registration: OpenServRegistration = {
    registrationId,
    serviceName,
    serviceEndpoint,
    workflowType,
    agentIdentity: {
      agentId,
      operatorWallet: identity.operatorWallet,
      erc8004Identity: identity.erc8004Identity,
      name: identity.agentName,
    },
    pricingUsdc,
    registeredAt,
  };

  // 4. Record registration evidence
  const evidenceContent: Record<string, unknown> = {
    action: "openserv_workflow_registration",
    integration: "openserv",
    registrationId,
    serviceName,
    serviceEndpoint,
    workflowType,
    pricingUsdc,
    registeredAt,
    agentIdentity: registration.agentIdentity,
    x402: {
      protocol: "x402",
      paymentRequired: pricingUsdc > 0,
      amountUsdc: pricingUsdc,
    },
    status: "registered",
  };

  const evidenceLogId = await recordOpenServEvidence(
    companyId,
    agentId,
    runId,
    "output",
    evidenceContent,
  );

  await recordActivityEvent(
    companyId,
    agentId,
    "openserv_workflow_registration",
    `OpenServ registration: service="${serviceName}" type=${workflowType} agent=${identity.agentName ?? agentId} pricing=${pricingUsdc} USDC`,
  );

  return {
    success: true,
    registration,
    evidenceLogId: evidenceLogId ?? undefined,
  };
}
