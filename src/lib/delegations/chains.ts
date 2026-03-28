/**
 * MetaMask Delegation Framework — Delegation Chains
 *
 * Builds hierarchical delegation chains:
 *   CEO wallet → department agent → task agent
 *
 * Each level inherits and further restricts the parent's permissions.
 * This enables scoped, least-privilege delegation across the agent org.
 */

import type {
  Permission,
  DelegationChain,
  DelegationChainNode,
} from "./types";
import { createDelegation } from "./framework";

/**
 * Restrict a child permission set so it never exceeds the parent's bounds.
 *
 * Rules:
 * - spendLimit.amount is capped at the parent's amount
 * - recipientWhitelist is intersected with the parent's (if parent has one)
 * - timeWindow is tightened to the overlap of parent and child windows
 * - taskPermissions is intersected with the parent's allowed set
 *
 * @param parent - The parent-level permission set
 * @param child  - The requested child-level permission set
 * @returns A new Permission that is the effective (most-restrictive) set
 */
export function restrictPermissions(
  parent: Permission,
  child: Permission,
): Permission {
  // Spend limit: take the smaller amount; currency and period follow the child
  const effectiveSpendLimit = {
    amount: Math.min(parent.spendLimit.amount, child.spendLimit.amount),
    currency: child.spendLimit.currency,
    period: child.spendLimit.period,
  };

  // Recipient whitelist: intersect when parent has entries
  let effectiveWhitelist: string[];
  if (parent.recipientWhitelist.length === 0) {
    // Parent allows any recipient — child decides
    effectiveWhitelist = [...child.recipientWhitelist];
  } else if (child.recipientWhitelist.length === 0) {
    // Child allows any — inherit parent restriction
    effectiveWhitelist = [...parent.recipientWhitelist];
  } else {
    // Both have entries — intersect (case-insensitive)
    const parentSet = new Set(
      parent.recipientWhitelist.map((a) => a.toLowerCase()),
    );
    effectiveWhitelist = child.recipientWhitelist.filter((addr) =>
      parentSet.has(addr.toLowerCase()),
    );
  }

  // Time window: tighten to the overlap
  const effectiveStart =
    new Date(parent.timeWindow.start) > new Date(child.timeWindow.start)
      ? parent.timeWindow.start
      : child.timeWindow.start;
  const effectiveEnd =
    new Date(parent.timeWindow.end) < new Date(child.timeWindow.end)
      ? parent.timeWindow.end
      : child.timeWindow.end;

  // Task permissions: intersect
  const parentTaskSet = new Set(parent.taskPermissions);
  const effectiveTaskPermissions = child.taskPermissions.filter((t) =>
    parentTaskSet.has(t),
  );

  return {
    spendLimit: effectiveSpendLimit,
    recipientWhitelist: effectiveWhitelist,
    timeWindow: { start: effectiveStart, end: effectiveEnd },
    taskPermissions: effectiveTaskPermissions,
  };
}

/**
 * Build a 3-level hierarchical delegation chain:
 *   CEO → department agent → task agent
 *
 * Each level creates a delegation whose permissions are the intersection
 * (most-restrictive) of the parent's grant and the requested limits.
 *
 * @param ceoWallet          - CEO wallet address (root of trust)
 * @param departmentAgent    - Department-level agent address/ID
 * @param taskAgent          - Task-level agent address/ID
 * @param ceoPermissions     - Permissions the CEO grants to the department
 * @param departmentPermissions - Permissions the department grants to the task agent
 *                               (will be further restricted by CEO permissions)
 * @returns A DelegationChain with 3 ordered nodes
 */
export function buildDelegationChain(
  ceoWallet: string,
  departmentAgent: string,
  taskAgent: string,
  ceoPermissions: Permission,
  departmentPermissions: Permission,
): DelegationChain {
  // Level 1: CEO → department
  const ceoDelegation = createDelegation(
    ceoWallet,
    departmentAgent,
    ceoPermissions,
  );

  // Level 2: department → task agent (restricted by CEO's grant)
  const effectiveTaskPermissions = restrictPermissions(
    ceoPermissions,
    departmentPermissions,
  );

  const departmentDelegation = createDelegation(
    departmentAgent,
    taskAgent,
    effectiveTaskPermissions,
    ceoDelegation.id,
  );

  // Assemble the chain
  const nodes: DelegationChainNode[] = [
    {
      address: ceoWallet,
      role: "CEO",
      delegation: null, // root — no inbound delegation
    },
    {
      address: departmentAgent,
      role: "department",
      delegation: ceoDelegation,
    },
    {
      address: taskAgent,
      role: "task_agent",
      delegation: departmentDelegation,
    },
  ];

  const chainId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? `chain_${crypto.randomUUID()}`
      : `chain_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  return {
    id: chainId,
    nodes,
    createdAt: new Date().toISOString(),
  };
}
