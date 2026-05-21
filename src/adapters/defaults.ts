import type { CreateConfigValues } from "./types";

/**
 * Build a CreateConfigValues object populated with sensible defaults
 * for a given adapter type.
 *
 * Used when selecting an adapter through onboarding (harness step) so
 * the agent gets a valid initial adapter_config rather than an empty
 * or mismatched config object.
 */
export function buildDefaultConfigValues(
  adapterType: string,
): CreateConfigValues {
  return {
    adapterType,
    cwd: "",
    promptTemplate: "",
    model: "",
    thinkingEffort: "medium",
    chrome: false,
    dangerouslySkipPermissions: false,
    search: false,
    dangerouslyBypassSandbox: false,
    command: "",
    args: "",
    extraArgs: "",
    envVars: "",
    envBindings: {},
    adapterSchemaValues: {},
    url: "",
    bootstrapPrompt: "",
    maxTurnsPerRun: 90,
    heartbeatEnabled: false,
    intervalSec: 60,
  };
}
