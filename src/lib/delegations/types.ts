/**
 * MetaMask Delegation Framework — Types
 *
 * TypeScript types for the delegation framework including permissions,
 * delegation objects, delegation chains, and actions.
 *
 * The delegation model supports hierarchical sub-delegation:
 *   CEO → department agent → task agent
 * Each level inherits and further restricts the parent's permissions.
 */

// ---------------------------------------------------------------------------
// Permission primitives
// ---------------------------------------------------------------------------

/** Period over which a spend limit is enforced */
export type SpendPeriod = "per_transaction" | "hourly" | "daily" | "weekly" | "monthly";

/** Spend limit constraint for a delegation */
export interface SpendLimit {
  /** Maximum amount allowed (in the specified currency) */
  amount: number;
  /** Currency identifier (e.g. "USDC", "ETH") */
  currency: string;
  /** Time period for the limit */
  period: SpendPeriod;
}

/** Time window during which a delegation is valid */
export interface TimeWindow {
  /** ISO-8601 start timestamp */
  start: string;
  /** ISO-8601 end timestamp */
  end: string;
}

/** Full permission set attached to a delegation */
export interface Permission {
  /** Spending limit constraints */
  spendLimit: SpendLimit;
  /** Addresses the delegate is allowed to send to */
  recipientWhitelist: string[];
  /** Time window during which the delegation is active */
  timeWindow: TimeWindow;
  /** Named tasks/operations the delegate is authorised to perform */
  taskPermissions: string[];
}

// ---------------------------------------------------------------------------
// Delegation lifecycle
// ---------------------------------------------------------------------------

/** Status of a delegation through its lifecycle */
export type DelegationStatus = "active" | "revoked" | "expired";

/** A single delegation from one wallet/agent to another */
export interface Delegation {
  /** Unique delegation identifier */
  id: string;
  /** Wallet address or agent ID of the delegator */
  from: string;
  /** Wallet address or agent ID of the delegate */
  to: string;
  /** Permissions granted by this delegation */
  permissions: Permission;
  /** Current lifecycle status */
  status: DelegationStatus;
  /** ISO-8601 timestamp of creation */
  createdAt: string;
  /** ISO-8601 timestamp of last status change */
  updatedAt: string;
  /** Optional parent delegation ID (for sub-delegations) */
  parentDelegationId?: string;
}

// ---------------------------------------------------------------------------
// Delegation chain (hierarchical sub-delegation)
// ---------------------------------------------------------------------------

/** A node in the delegation chain */
export interface DelegationChainNode {
  /** The wallet address / agent ID at this level */
  address: string;
  /** Role label (e.g. "CEO", "department", "task_agent") */
  role: string;
  /** Delegation granting authority from the parent to this node (null for root) */
  delegation: Delegation | null;
}

/** A complete delegation chain from root to leaf */
export interface DelegationChain {
  /** Unique identifier for the chain */
  id: string;
  /** Ordered nodes from CEO (root) → department → task agent (leaf) */
  nodes: DelegationChainNode[];
  /** ISO-8601 timestamp of chain creation */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Actions (for permission validation)
// ---------------------------------------------------------------------------

/** An action that a delegate wants to perform */
export interface DelegationAction {
  /** The type of action (must match a taskPermissions entry) */
  type: string;
  /** The amount involved (for spend-limit checks) */
  amount?: number;
  /** The currency of the amount */
  currency?: string;
  /** The recipient address (for whitelist checks) */
  recipient?: string;
  /** ISO-8601 timestamp of when the action is being attempted */
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

/** Result returned by permission validators */
export interface PermissionValidationResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Human-readable reason when denied */
  reason?: string;
}
