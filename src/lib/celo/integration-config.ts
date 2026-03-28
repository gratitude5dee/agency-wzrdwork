/**
 * Celo Integration — Configuration Persistence
 *
 * Retrieves and persists Celo integration configuration for the
 * active company context via the `integrations` table.
 *
 * The Celo config includes:
 * - `network` — selected Celo network (mainnet / alfajores testnet)
 * - `treasury_address` — the company's Celo treasury wallet address
 * - `preferred_stablecoin` — cUSD or cEUR
 * - `enabled` — whether the integration is active
 *
 * Configuration is company-scoped via `company_id` + `integration_key = "celo"`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/* ================================================================
   Types
   ================================================================ */

/** Celo network type */
export type CeloNetwork = "mainnet" | "alfajores";

/** Celo stablecoin preference */
export type CeloStablecoin = "cUSD" | "cEUR";

/** Celo integration configuration shape */
export interface CeloConfig {
  /** Whether the Celo integration is enabled */
  enabled: boolean;
  /** Selected network */
  network: CeloNetwork | null;
  /** Treasury wallet address */
  treasuryAddress: string | null;
  /** Preferred stablecoin */
  preferredStablecoin: CeloStablecoin | null;
  /** Whether the integration has a valid config (enabled + network) */
  configured: boolean;
}

/** Raw config stored in the integrations.config JSONB column */
interface CeloRawConfig {
  network?: string;
  treasury_address?: string;
  preferred_stablecoin?: string;
  [key: string]: unknown;
}

/* ================================================================
   Config Retrieval
   ================================================================ */

/**
 * Load the Celo integration configuration for a company.
 *
 * Reads from the `integrations` table where `integration_key = "celo"`
 * and `company_id` matches. Returns a normalized config shape.
 *
 * @param companyId - The company UUID
 * @returns The Celo config, or a default disconnected config
 */
export async function loadCeloConfig(
  companyId: string,
): Promise<CeloConfig> {
  const { data, error } = await supabase
    .from("integrations")
    .select("enabled, config")
    .eq("company_id", companyId)
    .eq("integration_key", "celo")
    .maybeSingle();

  if (error || !data) {
    return {
      enabled: false,
      network: null,
      treasuryAddress: null,
      preferredStablecoin: null,
      configured: false,
    };
  }

  const rawConfig = (data.config ?? {}) as CeloRawConfig;
  const network = (rawConfig.network as CeloNetwork) ?? null;
  const treasuryAddress = rawConfig.treasury_address ?? null;
  const preferredStablecoin = (rawConfig.preferred_stablecoin as CeloStablecoin) ?? null;

  return {
    enabled: data.enabled ?? false,
    network,
    treasuryAddress,
    preferredStablecoin,
    configured: data.enabled === true && network !== null,
  };
}

/**
 * Save Celo integration configuration for a company.
 *
 * Upserts the `integrations` row for `integration_key = "celo"`.
 *
 * @param companyId - The company UUID
 * @param network - The Celo network to configure
 * @param treasuryAddress - Optional treasury wallet address
 * @param preferredStablecoin - Optional preferred stablecoin (cUSD or cEUR)
 */
export async function saveCeloConfig(
  companyId: string,
  network: CeloNetwork,
  treasuryAddress?: string,
  preferredStablecoin?: CeloStablecoin,
): Promise<void> {
  const config: CeloRawConfig = {
    network,
  };
  if (treasuryAddress) {
    config.treasury_address = treasuryAddress;
  }
  if (preferredStablecoin) {
    config.preferred_stablecoin = preferredStablecoin;
  }

  // Check if row exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", "celo")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({
        config: config as unknown as Json,
        enabled: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update Celo config: ${error.message}`);
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: "celo",
      name: "celo",
      enabled: true,
      config: config as unknown as Json,
    });
    if (error) throw new Error(`Failed to insert Celo config: ${error.message}`);
  }
}
