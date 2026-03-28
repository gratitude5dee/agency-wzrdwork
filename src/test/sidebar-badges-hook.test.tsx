import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const mockGetSidebarBadges = vi.fn();

vi.mock("@/lib/server-api/sidebar-badges", () => ({
  getSidebarBadges: (...args: unknown[]) => mockGetSidebarBadges(...args),
}));

vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "co-1", name: "Test Co", slug: "test-co", wallet_address: null },
    companyId: "co-1",
    isLoading: false,
    error: null,
  }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("useSidebarBadges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSidebarBadges.mockResolvedValue({
      inbox: 4,
      approvals: 2,
      failedRuns: 2,
      joinRequests: 0,
    });
  });

  it("loads sidebar badges from the server route", async () => {
    const { useSidebarBadges } = await import("@/hooks/useSidebarBadges");

    function TestComp() {
      const { data, isSuccess } = useSidebarBadges();
      if (!isSuccess) return <div>loading</div>;
      return <div data-testid="inbox">{data?.inbox ?? 0}</div>;
    }

    renderWithProviders(<TestComp />);

    const badge = await screen.findByTestId("inbox");
    expect(badge.textContent).toBe("4");
    expect(mockGetSidebarBadges).toHaveBeenCalledWith({ companyId: "co-1" });
  });
});
