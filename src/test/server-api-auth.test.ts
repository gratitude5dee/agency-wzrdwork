import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("server API auth helpers", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/cockpit");
  });

  afterEach(() => {
    delete (import.meta.env as Record<string, unknown>).VITE_SERVER_URL;
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses same-origin server URLs when VITE_SERVER_URL is unset", async () => {
    delete (import.meta.env as Record<string, unknown>).VITE_SERVER_URL;
    const { getServerBaseUrl } = await import("@/lib/server-api/http");

    expect(getServerBaseUrl()).toBe(window.location.origin);
  });

  it("loads access state from the existing auth session endpoint", async () => {
    delete (import.meta.env as Record<string, unknown>).VITE_SERVER_URL;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          actor: {
            user: {
              id: "user-1",
              wallet_address: "0xabc",
              display_name: null,
            },
            memberships: [
              {
                company_id: "company-1",
                role: "owner",
                permissions: {},
                status: "active",
              },
            ],
            instanceRoles: [],
          },
          activeCompany: {
            id: "company-1",
            name: "My Company",
            slug: "my-company",
            wallet_address: "0xabc",
          },
          accessibleCompanies: [
            {
              id: "company-1",
              name: "My Company",
              slug: "my-company",
              wallet_address: "0xabc",
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getAccessMe } = await import("@/lib/server-api/auth");
    const access = await getAccessMe("company-1");

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/auth/session?companyId=company-1`,
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(access.activeCompany?.id).toBe("company-1");
    expect(access.memberships).toEqual(access.actor.memberships);
    expect(access.instanceRoles).toEqual([]);
  });
});
