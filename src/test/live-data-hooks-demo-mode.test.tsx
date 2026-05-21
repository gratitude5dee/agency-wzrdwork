/**
 * Tests for live data hooks company-scoping and demo mode indicators.
 *
 * Verifies:
 *   - Dashboard metrics hooks are company-scoped via useActiveCompany
 *   - Sidebar hooks (useLiveRunCount, usePendingApprovalCount, useSidebarAgents) are company-scoped
 *   - Demo mode banner renders when snapshot source is not "supabase"
 *   - Demo mode banner does NOT render when snapshot source is "supabase"
 */

import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// ── Configurable active company state ──────────────────────────────────

let mockCompanyState = {
  company: { id: "co-1", name: "Test Co", slug: "test-co", wallet_address: null },
  companyId: "co-1" as string | null,
  isLoading: false,
  error: null,
};

vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => mockCompanyState,
  resolveActiveCompany: vi.fn(),
}));

// ── Supabase mock with tracking ────────────────────────────────────────

const eqCalls: Array<{ column: string; value: string }> = [];
const mockGetDashboardOverview = vi.fn();
const mockListAgentRecords = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn().mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: Record<string, any> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockImplementation((col: string, val: string) => {
        eqCalls.push({ column: col, value: val });
        return chain;
      });
      chain.not = vi.fn().mockReturnValue(chain);
      chain.in = vi.fn().mockResolvedValue({ count: 0, data: [], error: null });
      chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
      // For data queries that resolve via the chain
      chain.then = undefined; // ensure it's not treated as a promise
      return chain;
    }),
  },
}));

vi.mock("@/lib/server-api/dashboard", () => ({
  getDashboardOverview: (...args: unknown[]) => mockGetDashboardOverview(...args),
}));

vi.mock("@/lib/server-api/agents", () => ({
  listAgentRecords: (...args: unknown[]) => mockListAgentRecords(...args),
}));

// ── thirdweb mock (no real wallet) ─────────────────────────────────────

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => undefined,
  useActiveWallet: () => undefined,
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));

// ── Helpers ────────────────────────────────────────────────────────────

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

function makeDashboardOverview() {
  return {
    metrics: {
      agents: { total: 2, running: 1, active: 1 },
      issues: { open: 2, inProgress: 1, blocked: 1 },
      runs: { live: 1, succeeded: 0, failed: 0 },
      approvals: { pending: 1 },
    },
    latestRuns: [],
    urgentIssues: [],
    agentRows: [],
    pendingApprovals: [],
    recentActivity: [],
  };
}

// ── DemoModeBanner tests ───────────────────────────────────────────────

describe("DemoModeBanner", () => {
  it("renders with default message", async () => {
    const { DemoModeBanner } = await import("@/components/DemoModeBanner");
    renderWithProviders(<DemoModeBanner />);

    expect(screen.getByTestId("demo-mode-banner")).toBeInTheDocument();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(screen.getByText(/Connect a wallet/)).toBeInTheDocument();
  });

  it("renders with a custom message", async () => {
    const { DemoModeBanner } = await import("@/components/DemoModeBanner");
    renderWithProviders(
      <DemoModeBanner message="Schema missing, showing fallback data." />,
    );

    expect(screen.getByTestId("demo-mode-banner")).toBeInTheDocument();
    expect(screen.getByText(/Schema missing/)).toBeInTheDocument();
  });
});

// ── Company-scoped dashboard metrics ───────────────────────────────────

describe("useDashboardMetrics company scoping", () => {
  beforeEach(() => {
    eqCalls.length = 0;
    vi.clearAllMocks();
    mockGetDashboardOverview.mockResolvedValue(makeDashboardOverview());
    mockCompanyState = {
      company: { id: "co-1", name: "Test Co", slug: "test-co", wallet_address: null },
      companyId: "co-1",
      isLoading: false,
      error: null,
    };
  });

  it("useAgentMetrics includes company_id in the server request", async () => {
    const { useAgentMetrics } = await import("@/hooks/useDashboardMetrics");

    function TestComp() {
      const { isFetching } = useAgentMetrics();
      return <div data-testid="fetching">{isFetching ? "yes" : "no"}</div>;
    }

    renderWithProviders(<TestComp />);

    await waitFor(() => {
      expect(mockGetDashboardOverview).toHaveBeenCalledWith({ companyId: "co-1" });
    });
  });

  it("useIssueMetrics scopes the server request by company_id", async () => {
    const { useIssueMetrics } = await import("@/hooks/useDashboardMetrics");

    function TestComp() {
      const { isFetching } = useIssueMetrics();
      return <div data-testid="fetching">{isFetching ? "yes" : "no"}</div>;
    }

    renderWithProviders(<TestComp />);

    await waitFor(() => {
      expect(mockGetDashboardOverview).toHaveBeenCalledWith({ companyId: "co-1" });
    });
  });

  it("useRunMetrics scopes the server request by company_id", async () => {
    const { useRunMetrics } = await import("@/hooks/useDashboardMetrics");

    function TestComp() {
      const { isFetching } = useRunMetrics();
      return <div data-testid="fetching">{isFetching ? "yes" : "no"}</div>;
    }

    renderWithProviders(<TestComp />);

    await waitFor(() => {
      expect(mockGetDashboardOverview).toHaveBeenCalledWith({ companyId: "co-1" });
    });
  });

  it("useApprovalMetrics scopes the server request by company_id", async () => {
    const { useApprovalMetrics } = await import("@/hooks/useDashboardMetrics");

    function TestComp() {
      const { isFetching } = useApprovalMetrics();
      return <div data-testid="fetching">{isFetching ? "yes" : "no"}</div>;
    }

    renderWithProviders(<TestComp />);

    await waitFor(() => {
      expect(mockGetDashboardOverview).toHaveBeenCalledWith({ companyId: "co-1" });
    });
  });
});

// ── Company-scoped sidebar hooks ───────────────────────────────────────

describe("useSidebarAgents company scoping", () => {
  beforeEach(() => {
    eqCalls.length = 0;
    vi.clearAllMocks();
    mockListAgentRecords.mockResolvedValue([]);
    mockCompanyState = {
      company: { id: "co-2", name: "Sidebar Co", slug: "sidebar-co", wallet_address: null },
      companyId: "co-2",
      isLoading: false,
      error: null,
    };
  });

  it("passes company_id to the agents server request", async () => {
    const { useSidebarAgents } = await import("@/hooks/useSidebarAgents");

    function TestComp() {
      const { isFetching } = useSidebarAgents();
      return <div data-testid="fetching">{isFetching ? "yes" : "no"}</div>;
    }

    renderWithProviders(<TestComp />);

    await waitFor(() => {
      expect(mockListAgentRecords).toHaveBeenCalledWith({ companyId: "co-2" });
    });
  });
});

describe("useLiveRunCount company scoping", () => {
  beforeEach(() => {
    eqCalls.length = 0;
    vi.clearAllMocks();
    mockGetDashboardOverview.mockResolvedValue(makeDashboardOverview());
    mockCompanyState = {
      company: { id: "co-3", name: "Run Co", slug: "run-co", wallet_address: null },
      companyId: "co-3",
      isLoading: false,
      error: null,
    };
  });

  it("passes company_id to the dashboard server request", async () => {
    const { useLiveRunCount } = await import("@/hooks/useLiveRunCount");

    function TestComp() {
      const { isFetching } = useLiveRunCount();
      return <div data-testid="fetching">{isFetching ? "yes" : "no"}</div>;
    }

    renderWithProviders(<TestComp />);

    await waitFor(() => {
      expect(mockGetDashboardOverview).toHaveBeenCalledWith({ companyId: "co-3" });
    });
  });
});

describe("usePendingApprovalCount company scoping", () => {
  beforeEach(() => {
    eqCalls.length = 0;
    vi.clearAllMocks();
    mockGetDashboardOverview.mockResolvedValue(makeDashboardOverview());
    mockCompanyState = {
      company: { id: "co-4", name: "Approval Co", slug: "approval-co", wallet_address: null },
      companyId: "co-4",
      isLoading: false,
      error: null,
    };
  });

  it("passes company_id to the dashboard server request", async () => {
    const { usePendingApprovalCount } = await import("@/hooks/usePendingApprovalCount");

    function TestComp() {
      const { isFetching } = usePendingApprovalCount();
      return <div data-testid="fetching">{isFetching ? "yes" : "no"}</div>;
    }

    renderWithProviders(<TestComp />);

    await waitFor(() => {
      expect(mockGetDashboardOverview).toHaveBeenCalledWith({ companyId: "co-4" });
    });
  });
});

// ── Demo mode in dashboard rendering ───────────────────────────────────

describe("Dashboard demo mode visibility", () => {
  it("shows demo banner when snapshot source is demo", async () => {
    vi.doMock("@/hooks/useDashboardMetrics", () => ({
      useAgentMetrics: () => ({ data: { total: 2, running: 1, active: 1 } }),
      useIssueMetrics: () => ({ data: { open: 2, inProgress: 1, blocked: 1 } }),
      useRunMetrics: () => ({ data: { live: 1, succeeded: 0, failed: 0 } }),
      useApprovalMetrics: () => ({ data: 1 }),
    }));

    vi.doMock("@/features/cockpit/lib/useAgencyData", () => ({
      useAgencyData: () => ({
        snapshot: {
          company: { id: "demo", name: "Demo", slug: "demo", companyType: "demo", description: "", brief: "", brandColor: "#000", createdAt: "", updatedAt: "" },
          agents: [],
          projects: [],
          goals: [],
          issues: [],
          approvals: [],
          runs: [],
          activity: [],
          source: "demo",
          sourceMessage: "Showing demo data until schema is applied.",
        },
        isLoading: false,
      }),
    }));

    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    const banner = screen.getByTestId("demo-mode-banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/Demo mode/)).toBeInTheDocument();
    expect(screen.getByText(/Showing demo data/)).toBeInTheDocument();

    vi.doUnmock("@/hooks/useDashboardMetrics");
    vi.doUnmock("@/features/cockpit/lib/useAgencyData");
  });
});
