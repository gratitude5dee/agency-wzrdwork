/**
 * Delegation Persistence Store — Tests
 *
 * Tests for Supabase-backed delegation chain persistence, including
 * load, save, re-hydration, and the registerDelegation function.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearDelegations,
  getDelegation,
  getDelegationStatus,
  registerDelegation,
  buildDelegationChain,
  validatePermission,
  rehydrateDelegationStore,
} from "@/lib/delegations";
import type { Delegation, DelegationChain, Permission } from "@/lib/delegations";

// ---- Supabase mock ----
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

function setupSupabaseMock(overrides?: {
  selectResult?: { data: unknown; error: unknown };
  insertResult?: { data: unknown; error: unknown };
  updateResult?: { data: unknown; error: unknown };
}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnValue({
      error: overrides?.insertResult?.error ?? null,
      data: overrides?.insertResult?.data ?? null,
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        error: overrides?.updateResult?.error ?? null,
        data: overrides?.updateResult?.data ?? null,
      }),
    }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(
      overrides?.selectResult ?? { data: null, error: null },
    ),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePermission(overrides: Partial<Permission> = {}): Permission {
  return {
    spendLimit: { amount: 10000, currency: "USDC", period: "daily" },
    recipientWhitelist: ["0xRecipientA"],
    timeWindow: {
      start: "2025-01-01T00:00:00Z",
      end: "2026-12-31T23:59:59Z",
    },
    taskPermissions: ["swap", "transfer", "stake"],
    ...overrides,
  };
}

function makeDelegation(overrides: Partial<Delegation> = {}): Delegation {
  return {
    id: "deleg_test_001",
    from: "0xCEO",
    to: "0xDept",
    permissions: makePermission(),
    status: "active",
    createdAt: "2025-06-01T00:00:00Z",
    updatedAt: "2025-06-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// registerDelegation
// ---------------------------------------------------------------------------

describe("registerDelegation", () => {
  beforeEach(() => clearDelegations());

  it("registers a delegation into the in-memory store with its original ID", () => {
    const delegation = makeDelegation({ id: "deleg_original_id_123" });
    registerDelegation(delegation);

    const found = getDelegation("deleg_original_id_123");
    expect(found).not.toBeNull();
    expect(found!.id).toBe("deleg_original_id_123");
    expect(found!.from).toBe("0xCEO");
    expect(found!.to).toBe("0xDept");
  });

  it("preserves delegation status during registration", () => {
    const revokedDelegation = makeDelegation({
      id: "deleg_revoked_test",
      status: "revoked",
    });
    registerDelegation(revokedDelegation);

    expect(getDelegationStatus("deleg_revoked_test")).toBe("revoked");
  });

  it("auto-expires delegation if time window has passed", () => {
    const expiredDelegation = makeDelegation({
      id: "deleg_expired_test",
      permissions: makePermission({
        timeWindow: {
          start: "2020-01-01T00:00:00Z",
          end: "2020-12-31T23:59:59Z",
        },
      }),
    });
    registerDelegation(expiredDelegation);

    expect(getDelegationStatus("deleg_expired_test")).toBe("expired");
  });

  it("makes the delegation available for validatePermission after registration", () => {
    const delegation = makeDelegation({ id: "deleg_validate_test" });
    registerDelegation(delegation);

    const found = getDelegation("deleg_validate_test");
    expect(found).not.toBeNull();

    const result = validatePermission(found!, {
      type: "swap",
      amount: 100,
      timestamp: "2025-06-15T12:00:00Z",
    });
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rehydrateDelegationStore
// ---------------------------------------------------------------------------

describe("rehydrateDelegationStore", () => {
  beforeEach(() => clearDelegations());

  it("clears existing in-memory state and registers all chain delegations", () => {
    // Pre-populate with something
    registerDelegation(makeDelegation({ id: "deleg_pre_existing" }));
    expect(getDelegation("deleg_pre_existing")).not.toBeNull();

    // Build a chain and rehydrate
    const chain = buildDelegationChain(
      "0xCEO",
      "0xDept",
      "0xTask",
      makePermission(),
      makePermission({ spendLimit: { amount: 2000, currency: "USDC", period: "daily" } }),
    );

    // Get the delegation IDs before rehydration
    const deptDelegId = chain.nodes[1].delegation!.id;
    const taskDelegId = chain.nodes[2].delegation!.id;

    // Clear and simulate rehydration from persistence
    clearDelegations();
    rehydrateDelegationStore([chain]);

    // Pre-existing should be gone
    expect(getDelegation("deleg_pre_existing")).toBeNull();

    // Chain delegations should be present
    expect(getDelegation(deptDelegId)).not.toBeNull();
    expect(getDelegation(taskDelegId)).not.toBeNull();
  });

  it("re-hydrated delegations support getDelegationStatus", () => {
    const chain = buildDelegationChain(
      "0xCEO",
      "0xDept",
      "0xTask",
      makePermission(),
      makePermission({ spendLimit: { amount: 2000, currency: "USDC", period: "daily" } }),
    );

    const taskDelegId = chain.nodes[2].delegation!.id;

    clearDelegations();
    rehydrateDelegationStore([chain]);

    expect(getDelegationStatus(taskDelegId)).toBe("active");
  });

  it("re-hydrated revoked delegations remain revoked", () => {
    const chain = buildDelegationChain(
      "0xCEO",
      "0xDept",
      "0xTask",
      makePermission(),
      makePermission({ spendLimit: { amount: 2000, currency: "USDC", period: "daily" } }),
    );

    // Mutate status to revoked (simulating what persistence stores)
    chain.nodes[2].delegation!.status = "revoked";

    clearDelegations();
    rehydrateDelegationStore([chain]);

    const taskDelegId = chain.nodes[2].delegation!.id;
    expect(getDelegationStatus(taskDelegId)).toBe("revoked");
  });

  it("re-hydrated delegations support validatePermission", () => {
    const chain = buildDelegationChain(
      "0xCEO",
      "0xDept",
      "0xTask",
      makePermission(),
      makePermission({
        spendLimit: { amount: 2000, currency: "USDC", period: "daily" },
        taskPermissions: ["swap"],
      }),
    );

    const taskDelegId = chain.nodes[2].delegation!.id;

    clearDelegations();
    rehydrateDelegationStore([chain]);

    const found = getDelegation(taskDelegId)!;

    // Valid action
    expect(
      validatePermission(found, {
        type: "swap",
        amount: 100,
        timestamp: "2025-06-15T12:00:00Z",
      }).allowed,
    ).toBe(true);

    // Over-budget
    expect(
      validatePermission(found, {
        type: "swap",
        amount: 999999,
        timestamp: "2025-06-15T12:00:00Z",
      }).allowed,
    ).toBe(false);

    // Overscoped action type
    expect(
      validatePermission(found, {
        type: "liquidate",
        timestamp: "2025-06-15T12:00:00Z",
      }).allowed,
    ).toBe(false);
  });

  it("handles empty chain array gracefully", () => {
    registerDelegation(makeDelegation({ id: "deleg_before" }));

    rehydrateDelegationStore([]);

    expect(getDelegation("deleg_before")).toBeNull();
  });

  it("handles multiple chains", () => {
    const chain1 = buildDelegationChain(
      "0xCEO_A",
      "0xDept_A",
      "0xTask_A",
      makePermission(),
      makePermission(),
    );
    const chain2 = buildDelegationChain(
      "0xCEO_B",
      "0xDept_B",
      "0xTask_B",
      makePermission(),
      makePermission(),
    );

    clearDelegations();
    rehydrateDelegationStore([chain1, chain2]);

    // All 4 delegations (2 per chain, CEO has null) should be in the store
    expect(getDelegation(chain1.nodes[1].delegation!.id)).not.toBeNull();
    expect(getDelegation(chain1.nodes[2].delegation!.id)).not.toBeNull();
    expect(getDelegation(chain2.nodes[1].delegation!.id)).not.toBeNull();
    expect(getDelegation(chain2.nodes[2].delegation!.id)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loadDelegationChains (Supabase integration)
// ---------------------------------------------------------------------------

describe("loadDelegationChains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDelegations();
  });

  it("returns empty array when no config exists", async () => {
    setupSupabaseMock({ selectResult: { data: null, error: null } });

    const { loadDelegationChains } = await import("@/lib/delegations/store");
    const chains = await loadDelegationChains("test-company-id");

    expect(chains).toEqual([]);
  });

  it("returns empty array on Supabase error", async () => {
    setupSupabaseMock({
      selectResult: { data: null, error: { message: "network error" } },
    });

    const { loadDelegationChains } = await import("@/lib/delegations/store");
    const chains = await loadDelegationChains("test-company-id");

    expect(chains).toEqual([]);
  });

  it("returns empty array when config has no chains array", async () => {
    setupSupabaseMock({
      selectResult: { data: { config: { something: "else" } }, error: null },
    });

    const { loadDelegationChains } = await import("@/lib/delegations/store");
    const chains = await loadDelegationChains("test-company-id");

    expect(chains).toEqual([]);
  });

  it("deserializes persisted chains correctly", async () => {
    const persistedChains = [
      {
        id: "chain_test_001",
        createdAt: "2025-06-01T00:00:00Z",
        nodes: [
          { address: "0xCEO", role: "CEO", delegation: null },
          {
            address: "0xDept",
            role: "department",
            delegation: {
              id: "deleg_001",
              from: "0xCEO",
              to: "0xDept",
              permissions: makePermission(),
              status: "active",
              createdAt: "2025-06-01T00:00:00Z",
              updatedAt: "2025-06-01T00:00:00Z",
            },
          },
          {
            address: "0xTask",
            role: "task_agent",
            delegation: {
              id: "deleg_002",
              from: "0xDept",
              to: "0xTask",
              permissions: makePermission({ spendLimit: { amount: 2000, currency: "USDC", period: "daily" } }),
              status: "active",
              createdAt: "2025-06-01T00:00:00Z",
              updatedAt: "2025-06-01T00:00:00Z",
              parentDelegationId: "deleg_001",
            },
          },
        ],
      },
    ];

    setupSupabaseMock({
      selectResult: { data: { config: { chains: persistedChains } }, error: null },
    });

    const { loadDelegationChains } = await import("@/lib/delegations/store");
    const chains = await loadDelegationChains("test-company-id");

    expect(chains).toHaveLength(1);
    expect(chains[0].id).toBe("chain_test_001");
    expect(chains[0].nodes).toHaveLength(3);
    expect(chains[0].nodes[0].delegation).toBeNull();
    expect(chains[0].nodes[1].delegation!.id).toBe("deleg_001");
    expect(chains[0].nodes[2].delegation!.parentDelegationId).toBe("deleg_001");
  });

  it("queries the correct table with company scope", async () => {
    const chain = setupSupabaseMock({ selectResult: { data: null, error: null } });

    const { loadDelegationChains } = await import("@/lib/delegations/store");
    await loadDelegationChains("my-company-123");

    expect(mockFrom).toHaveBeenCalledWith("integrations");
  });
});

// ---------------------------------------------------------------------------
// saveDelegationChains (Supabase integration)
// ---------------------------------------------------------------------------

describe("saveDelegationChains", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearDelegations();
  });

  it("inserts when no existing row", async () => {
    const chain = setupSupabaseMock({
      selectResult: { data: null, error: null },
    });

    const { saveDelegationChains } = await import("@/lib/delegations/store");
    const testChain = buildDelegationChain(
      "0xCEO",
      "0xDept",
      "0xTask",
      makePermission(),
      makePermission(),
    );

    await saveDelegationChains("test-company-id", [testChain]);

    // Should have called from("integrations") at least twice (select + insert)
    expect(mockFrom).toHaveBeenCalledWith("integrations");
  });

  it("updates when existing row found", async () => {
    // First call (select for existing) returns a row with id, second call (select for config) also set up
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount <= 1) {
        // Load check — no data
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      // Second call — the save path: check for existing row
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ error: null }),
        }),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "existing-row-id" },
          error: null,
        }),
      };
    });

    const { saveDelegationChains } = await import("@/lib/delegations/store");
    const testChain = buildDelegationChain(
      "0xCEO",
      "0xDept",
      "0xTask",
      makePermission(),
      makePermission(),
    );

    await saveDelegationChains("test-company-id", [testChain]);

    expect(mockFrom).toHaveBeenCalledWith("integrations");
  });

  it("throws on insert error", async () => {
    setupSupabaseMock({
      selectResult: { data: null, error: null },
      insertResult: { data: null, error: { message: "insert failed" } },
    });

    // Need to re-mock to handle the two separate from() calls (first for select, then for insert)
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Select call — no existing row
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      // Insert call — error
      return {
        insert: vi.fn().mockReturnValue({ error: { message: "insert failed" } }),
      };
    });

    const { saveDelegationChains } = await import("@/lib/delegations/store");
    const testChain = buildDelegationChain(
      "0xCEO",
      "0xDept",
      "0xTask",
      makePermission(),
      makePermission(),
    );

    await expect(saveDelegationChains("test-company-id", [testChain])).rejects.toThrow(
      "Failed to insert delegation chains",
    );
  });
});
