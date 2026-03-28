/**
 * Integration Config → Downstream Behavior Proof (VAL-CROSS-005)
 *
 * Verifies that changing a named integration's configuration survives
 * reload (by re-reading from Supabase) and produces an observable
 * downstream behavior change.
 *
 * "Downstream behavior" means the config value influences a product
 * or tool surface — not just a row in the integrations table. Each
 * named integration has a specific downstream proof path:
 *
 * - **venice**: adapter_config.private_cognition_model on the agent
 *   reflects the Venice model configured for the company, and Venice-
 *   routed runs use that model.
 * - **bankr**: loadBankrConfig returns the saved default_model and
 *   the inference flow routes through that model.
 * - **uniswap**: loadUniswapConfig returns the saved chain_id and
 *   token pair for the company.
 * - **composio**: useComposioConfig returns the selected tools from
 *   the saved configuration, and agent tools reflect those selections.
 *
 * This module provides a generic check: save config → re-read config
 * → verify the re-read value matches the saved value. Integration-
 * specific downstream proofs are composed in tests.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/* ================================================================
   Types
   ================================================================ */

export interface IntegrationConfigSnapshot {
  /** Integration key (e.g., "venice", "bankr") */
  integrationKey: string;
  /** Company ID that owns this config */
  companyId: string;
  /** Whether the integration is enabled */
  enabled: boolean;
  /** The config JSONB blob */
  config: Record<string, unknown>;
}

export interface IntegrationDownstreamProof {
  /** The integration being tested */
  integrationKey: string;
  /** The company context */
  companyId: string;
  /** Config as saved */
  savedConfig: Record<string, unknown>;
  /** Config as re-read after "reload" (re-query) */
  reloadedConfig: Record<string, unknown>;
  /** Whether the saved and reloaded configs match */
  configSurvivesReload: boolean;
  /** Specific downstream behavior observations */
  downstreamObservations: string[];
  /** Whether the full proof is valid */
  valid: boolean;
  /** Violations if any */
  violations: string[];
}

/* ================================================================
   Core Functions
   ================================================================ */

/**
 * Read the current integration config for a company.
 */
export async function readIntegrationConfig(
  companyId: string,
  integrationKey: string,
): Promise<IntegrationConfigSnapshot | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select("integration_key, company_id, enabled, config")
    .eq("company_id", companyId)
    .eq("integration_key", integrationKey)
    .maybeSingle();

  if (error || !data) return null;

  return {
    integrationKey: data.integration_key,
    companyId: data.company_id,
    enabled: data.enabled ?? false,
    config: (data.config ?? {}) as Record<string, unknown>,
  };
}

/**
 * Update an integration's config and enabled status for a company.
 *
 * Returns the updated snapshot, or null on failure.
 */
export async function updateIntegrationConfig(
  companyId: string,
  integrationKey: string,
  config: Record<string, unknown>,
  enabled: boolean = true,
): Promise<IntegrationConfigSnapshot | null> {
  // Check if existing row
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", integrationKey)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({ config: config as unknown as Json, enabled })
      .eq("id", existing.id);
    if (error) return null;
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: integrationKey,
      name: integrationKey,
      enabled,
      config: config as unknown as Json,
    });
    if (error) return null;
  }

  // Re-read to confirm persistence
  return readIntegrationConfig(companyId, integrationKey);
}

/**
 * Prove that saving a config change survives a "reload" (re-read)
 * and matches the expected value.
 *
 * This is the generic half of VAL-CROSS-005. Integration-specific
 * downstream behavior proofs are composed by calling this function
 * first, then verifying the downstream surface.
 */
export async function proveConfigSurvivesReload(
  companyId: string,
  integrationKey: string,
  newConfig: Record<string, unknown>,
): Promise<IntegrationDownstreamProof> {
  const violations: string[] = [];
  const observations: string[] = [];

  // 1. Save the config
  const saved = await updateIntegrationConfig(companyId, integrationKey, newConfig, true);
  if (!saved) {
    return {
      integrationKey,
      companyId,
      savedConfig: newConfig,
      reloadedConfig: {},
      configSurvivesReload: false,
      downstreamObservations: [],
      valid: false,
      violations: [`Failed to save config for ${integrationKey}`],
    };
  }
  observations.push(`Saved config for ${integrationKey}: ${JSON.stringify(newConfig)}`);

  // 2. Re-read the config (simulates page reload)
  const reloaded = await readIntegrationConfig(companyId, integrationKey);
  if (!reloaded) {
    violations.push(`Config for ${integrationKey} not found after save`);
    return {
      integrationKey,
      companyId,
      savedConfig: newConfig,
      reloadedConfig: {},
      configSurvivesReload: false,
      downstreamObservations: observations,
      valid: false,
      violations,
    };
  }

  // 3. Compare saved vs reloaded
  const savedKeys = Object.keys(newConfig).sort();
  const configMatch = savedKeys.every(
    (key) => JSON.stringify(reloaded.config[key]) === JSON.stringify(newConfig[key]),
  );

  if (!configMatch) {
    violations.push(
      `Config mismatch after reload for ${integrationKey}: ` +
        `saved=${JSON.stringify(newConfig)}, reloaded=${JSON.stringify(reloaded.config)}`,
    );
  } else {
    observations.push(`Config survives reload for ${integrationKey}`);
  }

  if (!reloaded.enabled) {
    violations.push(`Integration ${integrationKey} is not enabled after save`);
  }

  return {
    integrationKey,
    companyId,
    savedConfig: newConfig,
    reloadedConfig: reloaded.config,
    configSurvivesReload: configMatch && reloaded.enabled,
    downstreamObservations: observations,
    valid: violations.length === 0,
    violations,
  };
}
