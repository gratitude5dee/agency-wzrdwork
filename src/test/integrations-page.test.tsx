import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// ---- Supabase mock ----

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ---- Active company mock ----
// Provide a stable active company so the page resolves its tenant context
// without needing a real wallet connection.
vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "test-co", name: "Test Co", slug: "test-co", wallet_address: null },
    companyId: "test-co",
    isLoading: false,
    error: null,
  }),
}));

// ---- Helpers ----

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

function setupSupabaseMock(overrides?: Record<string, unknown>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    limit: vi.fn().mockReturnThis(),
    ...overrides,
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---- Tests ----

describe("IntegrationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading and description", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    const chain = setupSupabaseMock();
    // Company query returns a company, integrations query returns empty
    chain.single.mockResolvedValue({
      data: { id: "test-co", wallet_address: null },
      error: null,
    });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Integrations")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/connect external services and apis/i),
    ).toBeInTheDocument();
  });

  it("renders all 17 integration cards including Composio", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    const chain = setupSupabaseMock();
    chain.single.mockResolvedValue({
      data: { id: "test-co", wallet_address: null },
      error: null,
    });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    // Verify all 17 integration names are present (16 original + Composio)
    const integrationNames = [
      "thirdweb",
      "supabase",
      "venice",
      "openserv",
      "uniswap",
      "bankr",
      "lido",
      "agentcash",
      "celo",
      "superrare",
      "ens",
      "self",
      "arkhai",
      "metamask",
      "fal",
      "bond_credit",
      "Composio",
    ];
    for (const name of integrationNames) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it("renders status badge on each card", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    const chain = setupSupabaseMock();
    chain.single.mockResolvedValue({
      data: { id: "test-co", wallet_address: null },
      error: null,
    });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    // All cards should show "Disconnected" by default
    const disconnectedBadges = screen.getAllByText("Disconnected");
    expect(disconnectedBadges.length).toBe(17);
  });

  it("renders Configure button on each card", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    const chain = setupSupabaseMock();
    chain.single.mockResolvedValue({
      data: { id: "test-co", wallet_address: null },
      error: null,
    });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    const configureButtons = screen.getAllByText("Configure");
    expect(configureButtons.length).toBe(17);
  });

  it("renders toggle switch on each card", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    const chain = setupSupabaseMock();
    chain.single.mockResolvedValue({
      data: { id: "test-co", wallet_address: null },
      error: null,
    });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBe(17);
  });

  it("shows category descriptions on cards", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    const chain = setupSupabaseMock();
    chain.single.mockResolvedValue({
      data: { id: "test-co", wallet_address: null },
      error: null,
    });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Auth")).toBeInTheDocument();
    });
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Private AI")).toBeInTheDocument();
    expect(screen.getByText("Token Swaps")).toBeInTheDocument();
  });

  it("opens Configure dialog when Configure button is clicked", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    const chain = setupSupabaseMock();
    chain.single.mockResolvedValue({
      data: { id: "test-co", wallet_address: null },
      error: null,
    });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    // Click the first Configure button
    const configureButtons = screen.getAllByText("Configure");
    fireEvent.click(configureButtons[0]);

    // Dialog should appear with the integration name and API key input
    await waitFor(() => {
      expect(screen.getByText("Configure thirdweb")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });

  it("reflects connected status from Supabase data", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");

    // Active company is provided via useActiveCompany mock.
    // Only need to mock the integrations table query.
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({
      data: [
        {
          id: "int-1",
          company_id: "test-co",
          integration_key: "thirdweb",
          name: "thirdweb",
          enabled: true,
          config: { api_key: "test-key" },
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ],
      error: null,
    });

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    // The rest should show "Disconnected"
    const disconnectedBadges = screen.getAllByText("Disconnected");
    expect(disconnectedBadges.length).toBe(16);
  });
});
