/**
 * AgentCash — Configuration Persistence
 *
 * Retrieves and persists AgentCash integration configuration for the
 * active company context via the `integrations` table.
 *
 * The AgentCash config includes:
 * - `wallet_address` — the AgentCash wallet address for x402 payments
 * - `payment_chain` — preferred payment chain (arbitrum / base / celo)
 * - `auto_settle` — whether to auto-settle received x402 payments
 * - `enabled` — whether the integration is active
 *
 * Configuration is company-scoped via `company_id` + `integration_key = "agentcash"`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/* ================================================================
   Types
   ================================================================ */

/** AgentCash payment chain */
export type AgentCashChain = "arbitrum" | "base" | "celo";

/** AgentCash integration configuration shape */
export interface AgentCashConfig {
  /** Whether the AgentCash integration is enabled */
  enabled: boolean;
  /** AgentCash wallet address */
  walletAddress: string | null;
  /** Preferred payment chain */
  paymentChain: AgentCashChain | null;
  /** Whether to auto-settle x402 payments */
  autoSettle: boolean;
  /** Whether the integration has a valid config (enabled + wallet) */
  configured: boolean;
}

/** Raw config stored in the integrations.config JSONB column */
interface AgentCashRawConfig {
  wallet_address?: string;
  payment_chain?: string;
  auto_settle?: boolean;
  [key: string]: unknown;
}

/* ================================================================
   Config Retrieval
   ================================================================ */

/**
 * Load the AgentCash integration configuration for a company.
 *
 * @param companyId - The company UUID
 * @returns The AgentCash config, or a default disconnected config
 */
export async function loadAgentCashConfig(
  companyId: string,
): Promise<AgentCashConfig> {
  const { data, error } = await supabase
    .from("integrations")
    .select("enabled, config")
    .eq("company_id", companyId)
    .eq("integration_key", "agentcash")
    .maybeSingle();

  if (error || !data) {
    return {
      enabled: false,
      walletAddress: null,
      paymentChain: null,
      autoSettle: false,
      configured: false,
    };
  }

  const rawConfig = (data.config ?? {}) as AgentCashRawConfig;
  const walletAddress = rawConfig.wallet_address ?? null;
  const paymentChain = (rawConfig.payment_chain as AgentCashChain) ?? null;
  const autoSettle = rawConfig.auto_settle ?? false;

  return {
    enabled: data.enabled ?? false,
    walletAddress,
    paymentChain,
    autoSettle,
    configured: data.enabled === true && walletAddress !== null,
  };
}

/**
 * Save AgentCash integration configuration for a company.
 *
 * @param companyId - The company UUID
 * @param walletAddress - The AgentCash wallet address
 * @param paymentChain - Optional payment chain preference
 * @param autoSettle - Optional auto-settle flag
 */
export async function saveAgentCashConfig(
  companyId: string,
  walletAddress: string,
  paymentChain?: AgentCashChain,
  autoSettle?: boolean,
): Promise<void> {
  const config: AgentCashRawConfig = {
    wallet_address: walletAddress,
  };
  if (paymentChain) {
    config.payment_chain = paymentChain;
  }
  if (autoSettle !== undefined) {
    config.auto_settle = autoSettle;
  }

  // Check if row exists
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("integration_key", "agentcash")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("integrations")
      .update({
        config: config as unknown as Json,
        enabled: true,
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Failed to update AgentCash config: ${error.message}`);
  } else {
    const { error } = await supabase.from("integrations").insert({
      company_id: companyId,
      integration_key: "agentcash",
      name: "agentcash",
      enabled: true,
      config: config as unknown as Json,
    });
    if (error) throw new Error(`Failed to insert AgentCash config: ${error.message}`);
  }
}
