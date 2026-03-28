/**
 * MetaMask Delegation Framework — Public API
 *
 * Re-exports the main functions, types, and utilities used
 * by the rest of the application.
 */

export {
  createDelegation,
  revokeDelegation,
  getDelegationStatus,
  listDelegations,
  getDelegation,
  clearDelegations,
  registerDelegation,
} from "./framework";

export { buildDelegationChain, restrictPermissions } from "./chains";

export { validatePermission, enforceSpendLimit } from "./permissions";

export {
  loadDelegationChains,
  saveDelegationChains,
  rehydrateDelegationStore,
} from "./store";

export type {
  SpendPeriod,
  SpendLimit,
  TimeWindow,
  Permission,
  DelegationStatus,
  Delegation,
  DelegationChainNode,
  DelegationChain,
  DelegationAction,
  PermissionValidationResult,
} from "./types";

// On-chain signing & enforcement
export {
  prepareSignedDelegation,
  confirmSignedDelegation,
  buildSignedDelegationChain,
  loadSignedDelegations,
  verifyDelegationSignature,
  DELEGATION_EIP712_DOMAIN,
  DELEGATION_EIP712_TYPES,
} from "./onchain";

export type {
  SignedDelegationInput,
  PreparedDelegationMessage,
  SignedDelegation,
  CreateSignedDelegationResult,
  ConfirmSignedDelegationResult,
} from "./onchain";
