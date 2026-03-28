/**
 * Uniswap Integration — Configuration Persistence
 *
 * Retrieves and persists Uniswap integration configuration for the
 * active company context via the `integrations` table.
 *
 * The Uniswap config includes:
 * - `chain_id` — selected chain for swap operations
 * - `api_key` — API key (stored but used server-side by the edge function)
 * - `enabled` — whether the integration is active
 *
 * Configuration is company-scoped via `company_id` + `integration_key = "uniswap"`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { SupportedChainId } from "./types";

/* ================================================================
   Types
   ================================================================ */

/** Uniswap integration configuration shape */
export interface UniswapConfig {
  /** Whether the Uniswap integration is enabled */
  enabled: boolean;
  /** Selected chain ID for swap operations */
  chainId: SupportedChainId | null;
  /** Whether the integration has a valid config (chain + enabled) */
  configured: boolean;
}

/** Raw config stored in the integrations.config JSONB column */
interface UniswapRawConfig {
  api_key?: string;
  chain_id?: string;
  [key: string]: unknown;
}

/* ================================================================
   Config Retrieval
   ================================================================ */

/**
 * Load the Uniswap integration configuration for a company.
 *
 * Reads from the `integrations` table where `integration_key = "uniswap"`
 * and `company_id` matches. Returns a normalized config shape.
 *
 * @param companyId - The company UUID
 * @returns The Uniswap config, or a default disconnected config
 */
export async function loadUniswapConfig(
  companyId: string,
): Promise<UniswapConfig> {
  const { data, error } = await supabase
    .from("integrations")
    .select("enabled, config")
    .eq("company_id", companyId)
    .eq("integration_key", "uniswap")
    .maybeSingle();

  if (error || !data) {
    return { enabled: false, chainId: null, configured: false };
  }

  const rawConfig = (data.config ?? {}) as UniswapRawConfig;
  const chainId = rawConfig.chain_id
    ? (Number(rawConfig.chain_id) as SupportedChainId)
    : null;

  return {
    enabled: data.enabled ?? false,
    chainId,
    configured: data.enabled === true && chainId !== null,
  };
}

/**
 * Save Uniswap integration configuration for a company.
 *
 * Upserts the `integrations` row for `integration_key = "uniswap"`.
 *
 * @param companyId - The company UUID
 * @param chainId - The chain ID to configure
 * @param apiKey - Optional API key (stored but used server-side)
 */
export async function saveUniswapConfig(
  companyId: string,
  chainId: SupportedChainId,
  apiKey?: string,
): Promise<void> {
  const config: UniswapRawConfig = {
    chain_id: String(chainId),
  };
  if (apiKey) {
    config.api_key = apiKey;
  }

  // Check if row exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", "uniswap")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({
        config: config as unknown as import("@/integrations/supabase/types").Json,
        enabled: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update Uniswap config: ${error.message}`);
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: "uniswap",
      name: "uniswap",
      enabled: true,
      config: config as unknown as import("@/integrations/supabase/types").Json,
    });
    if (error) throw new Error(`Failed to insert Uniswap config: ${error.message}`);
  }
}
