/**
 * MetaMask Delegation Framework — Permission Validation
 *
 * Validates actions against a delegation's constraints:
 *   - validatePermission(delegation, action)
 *   - enforceSpendLimit(delegation, amount)
 *
 * Used by the autonomous execution loop to ensure agents
 * operate within their delegated authority.
 */

import type {
  Delegation,
  DelegationAction,
  PermissionValidationResult,
} from "./types";

/**
 * Validate whether an action is allowed under a delegation's constraints.
 *
 * Checks (in order):
 * 1. Delegation is active (not revoked or expired)
 * 2. Action timestamp falls within the delegation's time window
 * 3. Action type is in the delegation's taskPermissions list
 * 4. Spend limit is not exceeded (if the action has an amount)
 * 5. Recipient is in the whitelist (if the action has a recipient)
 *
 * @param delegation - The delegation to validate against
 * @param action     - The action the delegate wants to perform
 * @returns Validation result with reason if denied
 */
export function validatePermission(
  delegation: Delegation,
  action: DelegationAction,
): PermissionValidationResult {
  // 1. Check delegation is active
  if (delegation.status !== "active") {
    return {
      allowed: false,
      reason: `Delegation is ${delegation.status}`,
    };
  }

  // 2. Check time window
  const actionTime = action.timestamp
    ? new Date(action.timestamp)
    : new Date();
  const windowStart = new Date(delegation.permissions.timeWindow.start);
  const windowEnd = new Date(delegation.permissions.timeWindow.end);

  if (actionTime < windowStart) {
    return {
      allowed: false,
      reason: `Action timestamp ${actionTime.toISOString()} is before delegation window start ${delegation.permissions.timeWindow.start}`,
    };
  }

  if (actionTime > windowEnd) {
    return {
      allowed: false,
      reason: `Action timestamp ${actionTime.toISOString()} is after delegation window end ${delegation.permissions.timeWindow.end}`,
    };
  }

  // 3. Check task permission
  if (!delegation.permissions.taskPermissions.includes(action.type)) {
    return {
      allowed: false,
      reason: `Action type "${action.type}" is not in the allowed task permissions: [${delegation.permissions.taskPermissions.join(", ")}]`,
    };
  }

  // 4. Check spend limit (if amount is specified)
  if (action.amount !== undefined) {
    if (action.amount < 0) {
      return {
        allowed: false,
        reason: "Action amount cannot be negative",
      };
    }
    if (action.amount > delegation.permissions.spendLimit.amount) {
      return {
        allowed: false,
        reason: `Amount ${action.amount} exceeds spend limit of ${delegation.permissions.spendLimit.amount} ${delegation.permissions.spendLimit.currency}`,
      };
    }
  }

  // 5. Check recipient whitelist (if action specifies a recipient and whitelist is non-empty)
  if (
    action.recipient &&
    delegation.permissions.recipientWhitelist.length > 0
  ) {
    const normalizedRecipient = action.recipient.toLowerCase();
    const normalizedWhitelist = delegation.permissions.recipientWhitelist.map(
      (addr) => addr.toLowerCase(),
    );

    if (!normalizedWhitelist.includes(normalizedRecipient)) {
      return {
        allowed: false,
        reason: `Recipient ${action.recipient} is not in the allowed whitelist`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Check whether a given amount is within a delegation's spend limit.
 *
 * @param delegation - The delegation to check against
 * @param amount     - The amount to validate
 * @returns Validation result with reason if denied
 */
export function enforceSpendLimit(
  delegation: Delegation,
  amount: number,
): PermissionValidationResult {
  if (delegation.status !== "active") {
    return {
      allowed: false,
      reason: `Delegation is ${delegation.status}`,
    };
  }

  if (amount < 0) {
    return {
      allowed: false,
      reason: "Amount cannot be negative",
    };
  }

  if (amount > delegation.permissions.spendLimit.amount) {
    return {
      allowed: false,
      reason: `Amount ${amount} exceeds spend limit of ${delegation.permissions.spendLimit.amount} ${delegation.permissions.spendLimit.currency}`,
    };
  }

  return { allowed: true };
}
