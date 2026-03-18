import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { OrgChart } from "@/pages/OrgChart";

// Mock Supabase client — return agents with reports_to hierarchy
const mockAgents = [
  {
    id: "agent-ceo",
    company_id: "c1",
    name: "CEO",
    role: "ceo",
    title: "Chief Executive",
    adapter_type: "claude_local",
    status: "active",
    capabilities: null,
    reports_to: null,
    seat_index: 1,
    private_cognition_enabled: false,
    adapter_config: {},
    adapter_overrides: {},
    venice_model: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "agent-eng",
    company_id: "c1",
    name: "Engineer",
    role: "founding_engineer",
    title: "Founding Engineer",
    adapter_type: "codex_local",
    status: "running",
    capabilities: null,
    reports_to: "agent-ceo",
    seat_index: 2,
    private_cognition_enabled: false,
    adapter_config: {},
    adapter_overrides: {},
    venice_model: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "agent-ops",
    company_id: "c1",
    name: "Ops Manager",
    role: "ops",
    title: "Operations",
    adapter_type: "process",
    status: "paused",
    capabilities: null,
    reports_to: "agent-ceo",
    seat_index: 3,
    private_cognition_enabled: false,
    adapter_config: {},
    adapter_overrides: {},
    venice_model: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: mockAgents,
          error: null,
        })),
        data: mockAgents,
        error: null,
      })),
    })),
  },
}));

// Mock useActiveCompany so OrgChart resolves its tenant context
vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "c1", name: "Test", slug: "test", wallet_address: null },
    companyId: "c1",
    isLoading: false,
    error: null,
  }),
  resolveActiveCompany: vi.fn(),
}));

// Mock useAgencyData to provide demo snapshot fallback
vi.mock("@/features/cockpit/lib/useAgencyData", () => ({
  useAgencyData: () => ({
    snapshot: {
      agents: [],
      company: { id: "c1", name: "Test", slug: "test", companyType: "startup", description: "", brief: "", brandColor: "#000", createdAt: "", updatedAt: "" },
      projects: [],
      goals: [],
      issues: [],
      approvals: [],
      runs: [],
      activity: [],
      source: "demo" as const,
    },
    isLoading: false,
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

function renderWithProviders(ui: React.ReactElement, { initialEntries }: { initialEntries?: string[] } = {}) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("OrgChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders agent hierarchy based on reports_to", async () => {
    renderWithProviders(<OrgChart />);

    // All three agents should appear
    expect(await screen.findByText("CEO")).toBeInTheDocument();
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.getByText("Ops Manager")).toBeInTheDocument();
  });

  it("displays agent cards with name, role, status dot, and adapter type", async () => {
    renderWithProviders(<OrgChart />);

    // Wait for data to load
    await screen.findByText("CEO");

    // Role labels should appear
    expect(screen.getByText("Chief Executive")).toBeInTheDocument();
    expect(screen.getByText("Founding Engineer")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();

    // Adapter type labels
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
  });

  it("renders SVG path connectors between parent and child nodes", async () => {
    renderWithProviders(<OrgChart />);
    await screen.findByText("CEO");

    // SVG path elements should exist for the 2 edges: CEO→Engineer, CEO→Ops
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();

    const paths = svg!.querySelectorAll("path");
    expect(paths.length).toBe(2);
  });

  it("shows zoom control buttons (+, -, Fit)", async () => {
    renderWithProviders(<OrgChart />);
    await screen.findByText("CEO");

    expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
    expect(screen.getByLabelText("Fit chart to screen")).toBeInTheDocument();
  });

  it("zoom buttons respond to clicks without error", async () => {
    renderWithProviders(<OrgChart />);
    await screen.findByText("CEO");

    const zoomIn = screen.getByLabelText("Zoom in");
    const zoomOut = screen.getByLabelText("Zoom out");
    const fit = screen.getByLabelText("Fit chart to screen");

    fireEvent.click(zoomIn);
    fireEvent.click(zoomOut);
    fireEvent.click(fit);

    // No error thrown — chart still renders
    expect(screen.getByText("CEO")).toBeInTheDocument();
  });

  it("clicking a node navigates to the agent detail route", async () => {
    // Render with routing so we can observe navigation
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/org-chart"]}>
          <Routes>
            <Route path="/org-chart" element={<OrgChart />} />
            <Route path="/agents/:id" element={<div data-testid="agent-detail">Agent Detail</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Wait for the chart to render
    const ceoCard = await screen.findByText("CEO");
    // Click on the org card (the parent div with data-org-card)
    const card = ceoCard.closest("[data-org-card]");
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    // Should navigate to agent detail
    expect(await screen.findByTestId("agent-detail")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/*  Sidebar navigation includes Org Chart link                         */
/* ------------------------------------------------------------------ */

// We mock the heavyweight thirdweb deps before importing AppShell
vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0xABC" }),
  useActiveWallet: () => ({}),
  useDisconnect: () => ({ disconnect: vi.fn() }),
}));

vi.mock("@/hooks/useWalletAddressSync", () => ({
  useTruncatedAddress: () => "0xAB…CD",
}));

vi.mock("@/hooks/useLiveRunCount", () => ({
  useLiveRunCount: () => ({ data: 0 }),
}));

vi.mock("@/hooks/usePendingApprovalCount", () => ({
  usePendingApprovalCount: () => ({ data: 0 }),
}));

vi.mock("@/hooks/useSidebarAgents", () => ({
  useSidebarAgents: () => ({ data: [] }),
}));

describe("Sidebar navigation org chart link", () => {
  it("COMPANY_ITEMS includes Org Chart pointing to /org-chart", async () => {
    const { COMPANY_ITEMS } = await import(
      "@/features/cockpit/components/AppShell"
    );
    const orgChartItem = COMPANY_ITEMS.find(
      (item: { to: string; label: string }) => item.to === "/org-chart",
    );
    expect(orgChartItem).toBeDefined();
    expect(orgChartItem!.label).toBe("Org Chart");
  });
});
