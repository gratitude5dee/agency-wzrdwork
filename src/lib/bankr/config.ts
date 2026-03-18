/**
 * Bankr Integration — Configuration Persistence
 *
 * Retrieves and persists Bankr integration configuration for the
 * active company context via the `integrations` table.
 *
 * The Bankr config includes:
 * - `default_model` — selected default model for inference routing
 * - `enabled` — whether the integration is active
 *
 * Configuration is company-scoped via `company_id` + `integration_key = "bankr"`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/* ================================================================
   Types
   ================================================================ */

/** Bankr integration configuration shape */
export interface BankrConfig {
  /** Whether the Bankr integration is enabled */
  enabled: boolean;
  /** Default model for inference routing */
  defaultModel: string | null;
  /** Whether the integration has a valid config (enabled + model) */
  configured: boolean;
}

/** Raw config stored in the integrations.config JSONB column */
interface BankrRawConfig {
  default_model?: string;
  [key: string]: unknown;
}

/* ================================================================
   Config Retrieval
   ================================================================ */

/**
 * Load the Bankr integration configuration for a company.
 *
 * Reads from the `integrations` table where `integration_key = "bankr"`
 * and `company_id` matches. Returns a normalized config shape.
 *
 * @param companyId - The company UUID
 * @returns The Bankr config, or a default disconnected config
 */
export async function loadBankrConfig(
  companyId: string,
): Promise<BankrConfig> {
  const { data, error } = await supabase
    .from("integrations")
    .select("enabled, config")
    .eq("company_id", companyId)
    .eq("integration_key", "bankr")
    .maybeSingle();

  if (error || !data) {
    return { enabled: false, defaultModel: null, configured: false };
  }

  const rawConfig = (data.config ?? {}) as BankrRawConfig;
  const defaultModel = rawConfig.default_model ?? null;

  return {
    enabled: data.enabled ?? false,
    defaultModel,
    configured: data.enabled === true && defaultModel !== null,
  };
}

/**
 * Save Bankr integration configuration for a company.
 *
 * Upserts the `integrations` row for `integration_key = "bankr"`.
 *
 * @param companyId - The company UUID
 * @param defaultModel - The default model to configure
 */
export async function saveBankrConfig(
  companyId: string,
  defaultModel: string,
): Promise<void> {
  const config: BankrRawConfig = {
    default_model: defaultModel,
  };

  // Check if row exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", "bankr")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({
        config: config as unknown as Json,
        enabled: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update Bankr config: ${error.message}`);
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: "bankr",
      name: "bankr",
      enabled: true,
      config: config as unknown as Json,
    });
    if (error) throw new Error(`Failed to insert Bankr config: ${error.message}`);
  }
}
