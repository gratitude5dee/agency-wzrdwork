/**
 * Lido Integration — Configuration Persistence
 *
 * Retrieves and persists Lido integration configuration for the
 * active company context via the `integrations` table.
 *
 * The Lido config includes:
 * - `network` — selected network (mainnet / goerli testnet)
 * - `treasury_address` — the company's staking treasury wallet
 * - `monitoring_mode` — active monitoring mode (position / rewards / withdrawal)
 * - `enabled` — whether the integration is active
 *
 * Configuration is company-scoped via `company_id` + `integration_key = "lido"`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/* ================================================================
   Types
   ================================================================ */

/** Lido network type */
export type LidoNetwork = "mainnet" | "goerli";

/** Lido monitoring mode */
export type LidoMonitoringMode = "position" | "rewards" | "withdrawal";

/** Lido integration configuration shape */
export interface LidoConfig {
  /** Whether the Lido integration is enabled */
  enabled: boolean;
  /** Selected network */
  network: LidoNetwork | null;
  /** Treasury wallet address for staking */
  treasuryAddress: string | null;
  /** Active monitoring mode */
  monitoringMode: LidoMonitoringMode | null;
  /** Whether the integration has a valid config (enabled + network) */
  configured: boolean;
}

/** Raw config stored in the integrations.config JSONB column */
interface LidoRawConfig {
  network?: string;
  treasury_address?: string;
  monitoring_mode?: string;
  [key: string]: unknown;
}

/* ================================================================
   Config Retrieval
   ================================================================ */

/**
 * Load the Lido integration configuration for a company.
 *
 * Reads from the `integrations` table where `integration_key = "lido"`
 * and `company_id` matches. Returns a normalized config shape.
 *
 * @param companyId - The company UUID
 * @returns The Lido config, or a default disconnected config
 */
export async function loadLidoConfig(
  companyId: string,
): Promise<LidoConfig> {
  const { data, error } = await supabase
    .from("integrations")
    .select("enabled, config")
    .eq("company_id", companyId)
    .eq("integration_key", "lido")
    .maybeSingle();

  if (error || !data) {
    return {
      enabled: false,
      network: null,
      treasuryAddress: null,
      monitoringMode: null,
      configured: false,
    };
  }

  const rawConfig = (data.config ?? {}) as LidoRawConfig;
  const network = (rawConfig.network as LidoNetwork) ?? null;
  const treasuryAddress = rawConfig.treasury_address ?? null;
  const monitoringMode = (rawConfig.monitoring_mode as LidoMonitoringMode) ?? null;

  return {
    enabled: data.enabled ?? false,
    network,
    treasuryAddress,
    monitoringMode,
    configured: data.enabled === true && network !== null,
  };
}

/**
 * Save Lido integration configuration for a company.
 *
 * Upserts the `integrations` row for `integration_key = "lido"`.
 *
 * @param companyId - The company UUID
 * @param network - The network to configure
 * @param treasuryAddress - Optional treasury wallet address
 * @param monitoringMode - Optional monitoring mode
 */
export async function saveLidoConfig(
  companyId: string,
  network: LidoNetwork,
  treasuryAddress?: string,
  monitoringMode?: LidoMonitoringMode,
): Promise<void> {
  const config: LidoRawConfig = {
    network,
  };
  if (treasuryAddress) {
    config.treasury_address = treasuryAddress;
  }
  if (monitoringMode) {
    config.monitoring_mode = monitoringMode;
  }

  // Check if row exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", "lido")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({
        config: config as unknown as Json,
        enabled: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update Lido config: ${error.message}`);
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: "lido",
      name: "lido",
      enabled: true,
      config: config as unknown as Json,
    });
    if (error) throw new Error(`Failed to insert Lido config: ${error.message}`);
  }
}
