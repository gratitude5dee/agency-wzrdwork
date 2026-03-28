/**
 * MetaMask Delegation Framework — Tests
 *
 * Tests for framework CRUD, delegation chains, permission validation,
 * spend limit enforcement, and barrel exports.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createDelegation,
  revokeDelegation,
  getDelegationStatus,
  listDelegations,
  getDelegation,
  clearDelegations,
} from "@/lib/delegations/framework";
import { buildDelegationChain, restrictPermissions } from "@/lib/delegations/chains";
import { validatePermission, enforceSpendLimit } from "@/lib/delegations/permissions";
import type { Permission, Delegation } from "@/lib/delegations/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CEO_WALLET = "0xCEO_wallet_address";
const DEPT_AGENT = "0xDepartment_agent_001";
const TASK_AGENT = "0xTask_agent_002";

function makePermission(overrides: Partial<Permission> = {}): Permission {
  return {
    spendLimit: {
      amount: 10000,
      currency: "USDC",
      period: "daily",
    },
    recipientWhitelist: ["0xRecipientA", "0xRecipientB"],
    timeWindow: {
      start: "2025-01-01T00:00:00Z",
      end: "2026-12-31T23:59:59Z",
    },
    taskPermissions: ["swap", "transfer", "stake"],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Framework — CRUD
// ---------------------------------------------------------------------------

describe("createDelegation", () => {
  beforeEach(() => clearDelegations());

  it("returns a delegation object with from, to, and permissions", () => {
    const perms = makePermission();
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, perms);

    expect(d.from).toBe(CEO_WALLET);
    expect(d.to).toBe(DEPT_AGENT);
    expect(d.permissions).toEqual(perms);
  });

  it("assigns a unique id starting with 'deleg_'", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    expect(d.id).toMatch(/^deleg_/);
  });

  it("sets status to 'active' on creation", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    expect(d.status).toBe("active");
  });

  it("sets createdAt and updatedAt timestamps", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    expect(d.createdAt).toBeTruthy();
    expect(d.updatedAt).toBeTruthy();
    expect(new Date(d.createdAt).getTime()).not.toBeNaN();
  });

  it("stores parentDelegationId when provided", () => {
    const parent = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    const child = createDelegation(DEPT_AGENT, TASK_AGENT, makePermission(), parent.id);
    expect(child.parentDelegationId).toBe(parent.id);
  });

  it("does not set parentDelegationId when omitted", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    expect(d.parentDelegationId).toBeUndefined();
  });
});

describe("revokeDelegation", () => {
  beforeEach(() => clearDelegations());

  it("sets delegation status to 'revoked'", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    const revoked = revokeDelegation(d.id);

    expect(revoked).not.toBeNull();
    expect(revoked!.status).toBe("revoked");
  });

  it("updates the updatedAt timestamp", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    const revoked = revokeDelegation(d.id);

    // updatedAt should be a valid ISO timestamp (may be same ms as creation)
    expect(revoked!.updatedAt).toBeTruthy();
    expect(new Date(revoked!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(d.createdAt).getTime(),
    );
  });

  it("returns null for unknown delegation ID", () => {
    expect(revokeDelegation("nonexistent")).toBeNull();
  });
});

describe("getDelegationStatus", () => {
  beforeEach(() => clearDelegations());

  it("returns 'active' for a newly created delegation", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    expect(getDelegationStatus(d.id)).toBe("active");
  });

  it("returns 'revoked' after revocation", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    revokeDelegation(d.id);
    expect(getDelegationStatus(d.id)).toBe("revoked");
  });

  it("returns 'expired' when time window has passed", () => {
    const pastPermission = makePermission({
      timeWindow: {
        start: "2020-01-01T00:00:00Z",
        end: "2020-12-31T23:59:59Z",
      },
    });
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, pastPermission);
    expect(getDelegationStatus(d.id)).toBe("expired");
  });

  it("returns null for unknown delegation ID", () => {
    expect(getDelegationStatus("nonexistent")).toBeNull();
  });
});

describe("listDelegations", () => {
  beforeEach(() => clearDelegations());

  it("returns delegations where address is the delegator", () => {
    createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    createDelegation(CEO_WALLET, TASK_AGENT, makePermission());

    const results = listDelegations(CEO_WALLET);
    expect(results).toHaveLength(2);
    expect(results.every((d) => d.from === CEO_WALLET)).toBe(true);
  });

  it("returns delegations where address is the delegate", () => {
    createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    createDelegation("0xOther", DEPT_AGENT, makePermission());

    const results = listDelegations(DEPT_AGENT);
    expect(results).toHaveLength(2);
    expect(results.every((d) => d.to === DEPT_AGENT)).toBe(true);
  });

  it("matches addresses case-insensitively", () => {
    createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    const results = listDelegations(CEO_WALLET.toLowerCase());
    expect(results).toHaveLength(1);
  });

  it("returns empty array when no delegations exist for address", () => {
    expect(listDelegations("0xUnknown")).toEqual([]);
  });
});

describe("getDelegation", () => {
  beforeEach(() => clearDelegations());

  it("returns the delegation by ID", () => {
    const d = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
    const found = getDelegation(d.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(d.id);
  });

  it("returns null for unknown ID", () => {
    expect(getDelegation("nonexistent")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Chains — hierarchical delegation
// ---------------------------------------------------------------------------

describe("restrictPermissions", () => {
  it("caps spend limit at the smaller of parent and child", () => {
    const parent = makePermission({ spendLimit: { amount: 10000, currency: "USDC", period: "daily" } });
    const child = makePermission({ spendLimit: { amount: 5000, currency: "USDC", period: "daily" } });

    const result = restrictPermissions(parent, child);
    expect(result.spendLimit.amount).toBe(5000);
  });

  it("caps spend limit when child requests more than parent", () => {
    const parent = makePermission({ spendLimit: { amount: 1000, currency: "USDC", period: "daily" } });
    const child = makePermission({ spendLimit: { amount: 5000, currency: "USDC", period: "daily" } });

    const result = restrictPermissions(parent, child);
    expect(result.spendLimit.amount).toBe(1000);
  });

  it("intersects recipient whitelists", () => {
    const parent = makePermission({ recipientWhitelist: ["0xA", "0xB", "0xC"] });
    const child = makePermission({ recipientWhitelist: ["0xB", "0xC", "0xD"] });

    const result = restrictPermissions(parent, child);
    expect(result.recipientWhitelist.map((a) => a.toLowerCase())).toEqual(
      ["0xb", "0xc"],
    );
  });

  it("inherits parent whitelist when child has none", () => {
    const parent = makePermission({ recipientWhitelist: ["0xA"] });
    const child = makePermission({ recipientWhitelist: [] });

    const result = restrictPermissions(parent, child);
    expect(result.recipientWhitelist).toEqual(["0xA"]);
  });

  it("uses child whitelist when parent allows any", () => {
    const parent = makePermission({ recipientWhitelist: [] });
    const child = makePermission({ recipientWhitelist: ["0xX"] });

    const result = restrictPermissions(parent, child);
    expect(result.recipientWhitelist).toEqual(["0xX"]);
  });

  it("tightens time window to the overlap", () => {
    const parent = makePermission({
      timeWindow: { start: "2025-01-01T00:00:00Z", end: "2025-12-31T23:59:59Z" },
    });
    const child = makePermission({
      timeWindow: { start: "2025-06-01T00:00:00Z", end: "2026-06-01T00:00:00Z" },
    });

    const result = restrictPermissions(parent, child);
    expect(result.timeWindow.start).toBe("2025-06-01T00:00:00Z");
    expect(result.timeWindow.end).toBe("2025-12-31T23:59:59Z");
  });

  it("intersects task permissions", () => {
    const parent = makePermission({ taskPermissions: ["swap", "transfer", "stake"] });
    const child = makePermission({ taskPermissions: ["swap", "bridge"] });

    const result = restrictPermissions(parent, child);
    expect(result.taskPermissions).toEqual(["swap"]);
  });
});

describe("buildDelegationChain", () => {
  beforeEach(() => clearDelegations());

  it("creates a 3-level hierarchy: CEO → department → task agent", () => {
    const ceoPerms = makePermission();
    const deptPerms = makePermission({
      spendLimit: { amount: 2000, currency: "USDC", period: "daily" },
      taskPermissions: ["swap"],
    });

    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      ceoPerms,
      deptPerms,
    );

    expect(chain.nodes).toHaveLength(3);
    expect(chain.nodes[0].role).toBe("CEO");
    expect(chain.nodes[1].role).toBe("department");
    expect(chain.nodes[2].role).toBe("task_agent");
  });

  it("sets correct addresses on each node", () => {
    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      makePermission(),
      makePermission(),
    );

    expect(chain.nodes[0].address).toBe(CEO_WALLET);
    expect(chain.nodes[1].address).toBe(DEPT_AGENT);
    expect(chain.nodes[2].address).toBe(TASK_AGENT);
  });

  it("CEO node has null delegation (root of trust)", () => {
    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      makePermission(),
      makePermission(),
    );

    expect(chain.nodes[0].delegation).toBeNull();
  });

  it("department node has a delegation from CEO", () => {
    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      makePermission(),
      makePermission(),
    );

    const deptDelegation = chain.nodes[1].delegation!;
    expect(deptDelegation.from).toBe(CEO_WALLET);
    expect(deptDelegation.to).toBe(DEPT_AGENT);
    expect(deptDelegation.status).toBe("active");
  });

  it("task agent delegation is a sub-delegation of the department delegation", () => {
    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      makePermission(),
      makePermission(),
    );

    const deptDelegation = chain.nodes[1].delegation!;
    const taskDelegation = chain.nodes[2].delegation!;

    expect(taskDelegation.from).toBe(DEPT_AGENT);
    expect(taskDelegation.to).toBe(TASK_AGENT);
    expect(taskDelegation.parentDelegationId).toBe(deptDelegation.id);
  });

  it("task agent permissions are further restricted by CEO permissions", () => {
    const ceoPerms = makePermission({
      spendLimit: { amount: 10000, currency: "USDC", period: "daily" },
      taskPermissions: ["swap", "transfer", "stake"],
    });
    const deptPerms = makePermission({
      spendLimit: { amount: 2000, currency: "USDC", period: "daily" },
      taskPermissions: ["swap", "bridge"],
    });

    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      ceoPerms,
      deptPerms,
    );

    const taskPerms = chain.nodes[2].delegation!.permissions;
    // Spend limit should be the smaller of 10000 and 2000
    expect(taskPerms.spendLimit.amount).toBe(2000);
    // Task permissions should be intersection: only "swap"
    expect(taskPerms.taskPermissions).toEqual(["swap"]);
  });

  it("assigns a chain ID starting with 'chain_'", () => {
    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      makePermission(),
      makePermission(),
    );

    expect(chain.id).toMatch(/^chain_/);
  });

  it("sets createdAt timestamp", () => {
    const chain = buildDelegationChain(
      CEO_WALLET,
      DEPT_AGENT,
      TASK_AGENT,
      makePermission(),
      makePermission(),
    );

    expect(chain.createdAt).toBeTruthy();
    expect(new Date(chain.createdAt).getTime()).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// Permissions — validation
// ---------------------------------------------------------------------------

describe("validatePermission", () => {
  beforeEach(() => clearDelegations());

  let delegation: Delegation;

  beforeEach(() => {
    delegation = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
  });

  it("allows a valid action within all constraints", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      amount: 100,
      currency: "USDC",
      recipient: "0xRecipientA",
      timestamp: "2025-06-15T12:00:00Z",
    });

    expect(result.allowed).toBe(true);
  });

  it("denies action on revoked delegation", () => {
    revokeDelegation(delegation.id);
    // Re-fetch from store
    const revoked = getDelegation(delegation.id)!;

    const result = validatePermission(revoked, { type: "swap" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("revoked");
  });

  it("denies action before time window starts", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      timestamp: "2024-01-01T00:00:00Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("before");
  });

  it("denies action after time window ends", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      timestamp: "2027-01-01T00:00:00Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("after");
  });

  it("denies action type not in taskPermissions", () => {
    const result = validatePermission(delegation, {
      type: "liquidate",
      timestamp: "2025-06-15T12:00:00Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("liquidate");
    expect(result.reason).toContain("not in the allowed task permissions");
  });

  it("denies amount exceeding spend limit", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      amount: 50000,
      timestamp: "2025-06-15T12:00:00Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds spend limit");
  });

  it("denies negative amount", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      amount: -100,
      timestamp: "2025-06-15T12:00:00Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("negative");
  });

  it("denies recipient not in whitelist", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      recipient: "0xUnknownAddr",
      timestamp: "2025-06-15T12:00:00Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in the allowed whitelist");
  });

  it("allows action without recipient when whitelist is non-empty", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      timestamp: "2025-06-15T12:00:00Z",
    });

    expect(result.allowed).toBe(true);
  });

  it("matches recipient case-insensitively", () => {
    const result = validatePermission(delegation, {
      type: "swap",
      recipient: "0xrecipienta",
      timestamp: "2025-06-15T12:00:00Z",
    });

    expect(result.allowed).toBe(true);
  });
});

describe("enforceSpendLimit", () => {
  beforeEach(() => clearDelegations());

  let delegation: Delegation;

  beforeEach(() => {
    delegation = createDelegation(CEO_WALLET, DEPT_AGENT, makePermission());
  });

  it("allows amount within limit", () => {
    const result = enforceSpendLimit(delegation, 5000);
    expect(result.allowed).toBe(true);
  });

  it("allows amount equal to limit", () => {
    const result = enforceSpendLimit(delegation, 10000);
    expect(result.allowed).toBe(true);
  });

  it("denies amount exceeding limit", () => {
    const result = enforceSpendLimit(delegation, 10001);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeds spend limit");
  });

  it("denies negative amount", () => {
    const result = enforceSpendLimit(delegation, -1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("negative");
  });

  it("denies on revoked delegation", () => {
    revokeDelegation(delegation.id);
    const revoked = getDelegation(delegation.id)!;

    const result = enforceSpendLimit(revoked, 100);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("revoked");
  });
});

// ---------------------------------------------------------------------------
// Barrel re-exports
// ---------------------------------------------------------------------------

describe("Delegations index re-exports", () => {
  it("exports framework functions from the barrel", async () => {
    const mod = await import("@/lib/delegations/index");
    expect(mod.createDelegation).toBeDefined();
    expect(typeof mod.createDelegation).toBe("function");
    expect(mod.revokeDelegation).toBeDefined();
    expect(typeof mod.revokeDelegation).toBe("function");
    expect(mod.getDelegationStatus).toBeDefined();
    expect(typeof mod.getDelegationStatus).toBe("function");
    expect(mod.listDelegations).toBeDefined();
    expect(typeof mod.listDelegations).toBe("function");
  });

  it("exports chain builder from the barrel", async () => {
    const mod = await import("@/lib/delegations/index");
    expect(mod.buildDelegationChain).toBeDefined();
    expect(typeof mod.buildDelegationChain).toBe("function");
    expect(mod.restrictPermissions).toBeDefined();
    expect(typeof mod.restrictPermissions).toBe("function");
  });

  it("exports permission validators from the barrel", async () => {
    const mod = await import("@/lib/delegations/index");
    expect(mod.validatePermission).toBeDefined();
    expect(typeof mod.validatePermission).toBe("function");
    expect(mod.enforceSpendLimit).toBeDefined();
    expect(typeof mod.enforceSpendLimit).toBe("function");
  });

  it("exports registerDelegation from the barrel", async () => {
    const mod = await import("@/lib/delegations/index");
    expect(mod.registerDelegation).toBeDefined();
    expect(typeof mod.registerDelegation).toBe("function");
  });

  it("exports persistence functions from the barrel", async () => {
    const mod = await import("@/lib/delegations/index");
    expect(mod.loadDelegationChains).toBeDefined();
    expect(typeof mod.loadDelegationChains).toBe("function");
    expect(mod.saveDelegationChains).toBeDefined();
    expect(typeof mod.saveDelegationChains).toBe("function");
    expect(mod.rehydrateDelegationStore).toBeDefined();
    expect(typeof mod.rehydrateDelegationStore).toBe("function");
  });
});
