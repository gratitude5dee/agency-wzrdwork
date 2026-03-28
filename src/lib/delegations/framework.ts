/**
 * MetaMask Delegation Framework — Core Functions
 *
 * CRUD operations for delegations:
 *   - createDelegation(from, to, permissions)
 *   - revokeDelegation(delegationId)
 *   - getDelegationStatus(delegationId)
 *   - listDelegations(walletAddress)
 *
 * Delegations are stored in-memory for the hackathon demo.
 * In production these would be backed by on-chain state or a
 * MetaMask Delegation Toolkit contract.
 */

import type { Delegation, Permission, DelegationStatus } from "./types";

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

/** In-memory delegation registry keyed by delegation ID */
const delegationStore = new Map<string, Delegation>();

/**
 * Generate a unique delegation ID.
 * Uses crypto.randomUUID when available, otherwise falls back to
 * a timestamp + random suffix.
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `deleg_${crypto.randomUUID()}`;
  }
  return `deleg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new delegation from one address/agent to another.
 *
 * @param from        - Wallet address or agent ID of the delegator
 * @param to          - Wallet address or agent ID of the delegate
 * @param permissions - Permission set for the delegation
 * @param parentDelegationId - Optional parent delegation (for sub-delegations)
 * @returns The newly created Delegation object
 */
export function createDelegation(
  from: string,
  to: string,
  permissions: Permission,
  parentDelegationId?: string,
): Delegation {
  const now = new Date().toISOString();
  const delegation: Delegation = {
    id: generateId(),
    from,
    to,
    permissions,
    status: "active",
    createdAt: now,
    updatedAt: now,
    parentDelegationId,
  };

  delegationStore.set(delegation.id, delegation);
  return delegation;
}

/**
 * Revoke an existing delegation.
 *
 * @param delegationId - The ID of the delegation to revoke
 * @returns The updated Delegation, or null if not found
 */
export function revokeDelegation(delegationId: string): Delegation | null {
  const delegation = delegationStore.get(delegationId);
  if (!delegation) return null;

  delegation.status = "revoked";
  delegation.updatedAt = new Date().toISOString();
  delegationStore.set(delegationId, delegation);
  return delegation;
}

/**
 * Get the current status of a delegation.
 *
 * Also checks if the delegation's time window has expired and updates
 * the status to "expired" when applicable.
 *
 * @param delegationId - The ID of the delegation to query
 * @returns The delegation status, or null if not found
 */
export function getDelegationStatus(
  delegationId: string,
): DelegationStatus | null {
  const delegation = delegationStore.get(delegationId);
  if (!delegation) return null;

  // Auto-expire if time window has passed
  if (delegation.status === "active") {
    const endDate = new Date(delegation.permissions.timeWindow.end);
    if (endDate.getTime() < Date.now()) {
      delegation.status = "expired";
      delegation.updatedAt = new Date().toISOString();
      delegationStore.set(delegationId, delegation);
    }
  }

  return delegation.status;
}

/**
 * List all delegations where the given address is either the delegator or delegate.
 *
 * @param walletAddress - Wallet address or agent ID to search for
 * @returns Array of matching Delegation objects
 */
export function listDelegations(walletAddress: string): Delegation[] {
  const results: Delegation[] = [];
  const normalizedAddr = walletAddress.toLowerCase();

  for (const delegation of delegationStore.values()) {
    if (
      delegation.from.toLowerCase() === normalizedAddr ||
      delegation.to.toLowerCase() === normalizedAddr
    ) {
      results.push(delegation);
    }
  }

  return results;
}

/**
 * Retrieve a delegation by ID.
 *
 * @param delegationId - The delegation ID
 * @returns The Delegation object, or null if not found
 */
export function getDelegation(delegationId: string): Delegation | null {
  return delegationStore.get(delegationId) ?? null;
}

/**
 * Clear all delegations from the in-memory store.
 * Useful for testing or resetting state.
 */
export function clearDelegations(): void {
  delegationStore.clear();
}

/**
 * Register a delegation directly into the in-memory store with its
 * original ID preserved. Used during re-hydration from persistence
 * so that `getDelegationStatus`, `validatePermission`, and
 * `enforceSpendLimit` work correctly against reloaded delegations.
 *
 * @param delegation - A full Delegation object (with its persisted ID)
 */
export function registerDelegation(delegation: Delegation): void {
  delegationStore.set(delegation.id, { ...delegation });
}
