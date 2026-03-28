import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IntegrationsPage } from "@/pages/Integrations";

const { getDashboardOverviewMock, listAgentRecordsMock, listCompanyIntegrationsMock } = vi.hoisted(() => ({
  getDashboardOverviewMock: vi.fn(),
  listAgentRecordsMock: vi.fn(),
  listCompanyIntegrationsMock: vi.fn(),
}));

vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "test-co", name: "Test Co", slug: "test-co", wallet_address: "0xabc" },
    companyId: "test-co",
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/lib/server-api/dashboard", () => ({
  getDashboardOverview: getDashboardOverviewMock,
}));

vi.mock("@/lib/server-api/agents", () => ({
  listAgentRecords: listAgentRecordsMock,
}));

vi.mock("@/lib/server-api/integrations", () => ({
  listCompanyIntegrations: listCompanyIntegrationsMock,
  upsertIntegrationRecord: vi.fn(),
}));

vi.mock("@/lib/server-api/actor", () => ({
  getClientWalletAddress: (address: string | null | undefined) => address ?? null,
}));

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0xabc" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/components/ComposioToolDiscovery", () => ({
  ComposioToolDiscovery: () => <div data-testid="composio-tools" />,
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("navigation data wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardOverviewMock.mockResolvedValue({
      metrics: {
        agents: { total: 2, running: 1, active: 2 },
        issues: { open: 3, inProgress: 1, blocked: 1 },
        runs: { live: 4, succeeded: 5, failed: 1 },
        approvals: { pending: 6 },
      },
      latestRuns: [],
      urgentIssues: [],
      agentRows: [],
      pendingApprovals: [],
      recentActivity: [],
    });
    listAgentRecordsMock.mockResolvedValue([]);
    listCompanyIntegrationsMock.mockResolvedValue([]);
  });

  it("uses dashboard overview for live run count", async () => {
    const { useLiveRunCount } = await import("@/hooks/useLiveRunCount");

    function TestComp() {
      const { data, isSuccess } = useLiveRunCount();
      if (!isSuccess) return <div>loading</div>;
      return <div data-testid="count">{data}</div>;
    }

    renderWithProviders(<TestComp />);

    const el = await screen.findByTestId("count");
    expect(el.textContent).toBe("4");
    expect(getDashboardOverviewMock).toHaveBeenCalledWith({ companyId: "test-co" });
  });

  it("uses dashboard overview for pending approval count", async () => {
    const { usePendingApprovalCount } = await import("@/hooks/usePendingApprovalCount");

    function TestComp() {
      const { data, isSuccess } = usePendingApprovalCount();
      if (!isSuccess) return <div>loading</div>;
      return <div data-testid="count">{data}</div>;
    }

    renderWithProviders(<TestComp />);

    const el = await screen.findByTestId("count");
    expect(el.textContent).toBe("6");
    expect(getDashboardOverviewMock).toHaveBeenCalledWith({ companyId: "test-co" });
  });

  it("uses server agent records for sidebar agents", async () => {
    listAgentRecordsMock.mockResolvedValue([
      { id: "agent-1", name: "Alpha" },
      { id: "agent-2", name: "Beta" },
    ]);

    const { useSidebarAgents } = await import("@/hooks/useSidebarAgents");

    function TestComp() {
      const { data, isSuccess } = useSidebarAgents();
      if (!isSuccess) return <div>loading</div>;
      return <div data-testid="count">{data?.length ?? 0}</div>;
    }

    renderWithProviders(<TestComp />);

    const el = await screen.findByTestId("count");
    expect(el.textContent).toBe("2");
    expect(listAgentRecordsMock).toHaveBeenCalledWith({ companyId: "test-co" });
  });

  it("renders integrations page through server-backed tenant wiring", async () => {
    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Integrations")).toBeInTheDocument();
    });
    expect(screen.getByText(/Connect external services and APIs/)).toBeInTheDocument();
    expect(listCompanyIntegrationsMock).toHaveBeenCalledWith({
      companyId: "test-co",
      walletAddress: "0xabc",
    });
  });
});
