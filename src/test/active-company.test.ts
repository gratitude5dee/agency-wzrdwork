/**
 * Tests for the active-company resolution helper (resolveActiveCompany).
 *
 * Verifies the two-stage resolution strategy:
 *   1. wallet → user_onboarding.company_id → companies row
 *   2. wallet → companies.wallet_address match
 *   3. null if neither path resolves
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---- Supabase mock ----

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ---- Helper to build chainable mock per table ----

function chainMock(overrides?: Record<string, unknown>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
}

describe("resolveActiveCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when wallet address is null", async () => {
    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    const result = await resolveActiveCompany(null);
    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("resolves company via onboarding row when present", async () => {
    const company = {
      id: "comp-1",
      name: "Acme Corp",
      slug: "acme-corp",
      wallet_address: "0xWALLET",
    };

    const onboardingChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { company_id: "comp-1" },
        error: null,
      }),
    });

    const companiesChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({
        data: company,
        error: null,
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "user_onboarding") return onboardingChain;
      return companiesChain;
    });

    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    const result = await resolveActiveCompany("0xWALLET");

    expect(result).toEqual(company);
    // Should query onboarding first, then companies by id
    expect(mockFrom).toHaveBeenCalledWith("user_onboarding");
    expect(mockFrom).toHaveBeenCalledWith("companies");
  });

  it("falls back to wallet_address match when no onboarding row", async () => {
    const company = {
      id: "comp-2",
      name: "Fallback Inc",
      slug: "fallback-inc",
      wallet_address: "0xFALLBACK",
    };

    const onboardingChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const companiesChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({
        data: company,
        error: null,
      }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "user_onboarding") return onboardingChain;
      return companiesChain;
    });

    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    const result = await resolveActiveCompany("0xFALLBACK");

    expect(result).toEqual(company);
  });

  it("returns null when neither onboarding nor wallet match resolves", async () => {
    const onboardingChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const companiesChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "user_onboarding") return onboardingChain;
      return companiesChain;
    });

    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    const result = await resolveActiveCompany("0xNONEXISTENT");

    expect(result).toBeNull();
  });

  it("handles onboarding row with company_id that has no matching company", async () => {
    const onboardingChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { company_id: "deleted-company" },
        error: null,
      }),
    });

    // First companies call (by id) returns null, second (by wallet) also null
    const companiesChain = chainMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "user_onboarding") return onboardingChain;
      return companiesChain;
    });

    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    const result = await resolveActiveCompany("0xORPHAN");

    // Falls through to wallet_address fallback, which also returns null
    expect(result).toBeNull();
  });
});
