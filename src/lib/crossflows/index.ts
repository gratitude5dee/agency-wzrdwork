/**
 * Crossflow Verification Utilities
 *
 * End-to-end trace functions that prove shared-ID coherence
 * across product surfaces for the validation contract assertions:
 *
 * - VAL-CROSS-003: Issue → Runtime trace
 * - VAL-CROSS-004: Payment → Company/Agent/Runtime trace
 * - VAL-CROSS-005: Integration config → Downstream behavior proof
 */

export { traceIssueRuntime } from "./issue-runtime-trace";
export type { IssueRuntimeTrace } from "./issue-runtime-trace";

export { tracePayment } from "./payment-trace";
export type { PaymentTrace } from "./payment-trace";

export {
  readIntegrationConfig,
  updateIntegrationConfig,
  proveConfigSurvivesReload,
} from "./integration-downstream";
export type {
  IntegrationConfigSnapshot,
  IntegrationDownstreamProof,
} from "./integration-downstream";
