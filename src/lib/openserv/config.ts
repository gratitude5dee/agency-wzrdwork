/**
 * OpenServ — Configuration Persistence
 *
 * Retrieves and persists OpenServ integration configuration for the
 * active company context via the `integrations` table.
 *
 * The OpenServ config includes:
 * - `service_name` — the registered x402 service name
 * - `service_endpoint` — the endpoint for the registered service
 * - `workflow_type` — type of workflow (task / orchestration / data_pipeline)
 * - `enabled` — whether the integration is active
 *
 * Configuration is company-scoped via `company_id` + `integration_key = "openserv"`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/* ================================================================
   Types
   ================================================================ */

/** OpenServ workflow type */
export type OpenServWorkflowType = "task" | "orchestration" | "data_pipeline";

/** OpenServ integration configuration shape */
export interface OpenServConfig {
  /** Whether the OpenServ integration is enabled */
  enabled: boolean;
  /** Registered service name */
  serviceName: string | null;
  /** Service endpoint URL */
  serviceEndpoint: string | null;
  /** Workflow type */
  workflowType: OpenServWorkflowType | null;
  /** Whether the integration has a valid config (enabled + service name) */
  configured: boolean;
}

/** Raw config stored in the integrations.config JSONB column */
interface OpenServRawConfig {
  service_name?: string;
  service_endpoint?: string;
  workflow_type?: string;
  [key: string]: unknown;
}

/* ================================================================
   Config Retrieval
   ================================================================ */

/**
 * Load the OpenServ integration configuration for a company.
 *
 * @param companyId - The company UUID
 * @returns The OpenServ config, or a default disconnected config
 */
export async function loadOpenServConfig(
  companyId: string,
): Promise<OpenServConfig> {
  const { data, error } = await supabase
    .from("integrations")
    .select("enabled, config")
    .eq("company_id", companyId)
    .eq("integration_key", "openserv")
    .maybeSingle();

  if (error || !data) {
    return {
      enabled: false,
      serviceName: null,
      serviceEndpoint: null,
      workflowType: null,
      configured: false,
    };
  }

  const rawConfig = (data.config ?? {}) as OpenServRawConfig;
  const serviceName = rawConfig.service_name ?? null;
  const serviceEndpoint = rawConfig.service_endpoint ?? null;
  const workflowType = (rawConfig.workflow_type as OpenServWorkflowType) ?? null;

  return {
    enabled: data.enabled ?? false,
    serviceName,
    serviceEndpoint,
    workflowType,
    configured: data.enabled === true && serviceName !== null,
  };
}

/**
 * Save OpenServ integration configuration for a company.
 *
 * @param companyId - The company UUID
 * @param serviceName - The service name to register
 * @param serviceEndpoint - Optional service endpoint URL
 * @param workflowType - Optional workflow type
 */
export async function saveOpenServConfig(
  companyId: string,
  serviceName: string,
  serviceEndpoint?: string,
  workflowType?: OpenServWorkflowType,
): Promise<void> {
  const config: OpenServRawConfig = {
    service_name: serviceName,
  };
  if (serviceEndpoint) {
    config.service_endpoint = serviceEndpoint;
  }
  if (workflowType) {
    config.workflow_type = workflowType;
  }

  // Check if row exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", "openserv")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({
        config: config as unknown as Json,
        enabled: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update OpenServ config: ${error.message}`);
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: "openserv",
      name: "openserv",
      enabled: true,
      config: config as unknown as Json,
    });
    if (error) throw new Error(`Failed to insert OpenServ config: ${error.message}`);
  }
}
