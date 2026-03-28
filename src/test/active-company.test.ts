import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAccessMe = vi.fn();

vi.mock("@/lib/server-api/auth", () => ({
  getAccessMe: (...args: unknown[]) => mockGetAccessMe(...args),
}));

describe("resolveActiveCompany", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the active company from access/me", async () => {
    const company = {
      id: "comp-1",
      name: "Acme Corp",
      slug: "acme-corp",
      wallet_address: "0xwallet",
    };

    mockGetAccessMe.mockResolvedValue({
      actor: null,
      activeCompany: company,
      accessibleCompanies: [company],
      memberships: [],
      instanceRoles: [],
    });

    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    await expect(resolveActiveCompany()).resolves.toEqual(company);
  });

  it("returns null when access/me has no active company", async () => {
    mockGetAccessMe.mockResolvedValue({
      actor: null,
      activeCompany: null,
      accessibleCompanies: [],
      memberships: [],
      instanceRoles: [],
    });

    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    await expect(resolveActiveCompany()).resolves.toBeNull();
  });

  it("returns null when access/me fails", async () => {
    mockGetAccessMe.mockRejectedValue(new Error("unauthorized"));

    const { resolveActiveCompany } = await import("@/hooks/useActiveCompany");
    await expect(resolveActiveCompany()).resolves.toBeNull();
  });
});
