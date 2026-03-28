import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const mockListCompanyIntegrations = vi.fn();
const mockUpsertIntegrationRecord = vi.fn();
vi.mock("@/lib/server-api/integrations", () => ({
  listCompanyIntegrations: (...args: unknown[]) => mockListCompanyIntegrations(...args),
  upsertIntegrationRecord: (...args: unknown[]) => mockUpsertIntegrationRecord(...args),
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

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0xtest" }),
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

function setIntegrationRows(rows: Record<string, unknown>[] = []) {
  mockListCompanyIntegrations.mockResolvedValue(rows);
  mockUpsertIntegrationRecord.mockResolvedValue({
    id: "int-upserted",
    company_id: "test-co",
    integration_key: "thirdweb",
    name: "thirdweb",
    enabled: true,
    config: {},
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  });
}

// ---- Tests ----

describe("IntegrationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setIntegrationRows();
  });

  it("renders page heading and description", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");

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

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    const configureButtons = screen.getAllByText("Configure");
    expect(configureButtons.length).toBe(17);
  });

  it("renders toggle switch on each card", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    const switches = screen.getAllByRole("switch");
    expect(switches.length).toBe(17);
  });

  it("shows category descriptions on cards", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");

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

  it("reflects connected status from server data", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    setIntegrationRows([
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
    ]);

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    // The rest should show "Disconnected"
    const disconnectedBadges = screen.getAllByText("Disconnected");
    expect(disconnectedBadges.length).toBe(16);
  });

  it("shows core and stretch tier badges on cards (VAL-INTEGRATIONS-001)", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    // Core integrations: thirdweb, supabase, venice, openserv, uniswap, bankr,
    // lido, agentcash, celo, metamask, Composio = 11
    const coreBadges = screen.getAllByText("Core");
    expect(coreBadges.length).toBe(11);

    // Stretch integrations: superrare, ens, self, arkhai, fal, bond_credit = 6
    const stretchBadges = screen.getAllByText("Stretch");
    expect(stretchBadges.length).toBe(6);
  });

  it("shows Misconfigured status when enabled but missing credentials (VAL-INTEGRATIONS-003)", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    setIntegrationRows([
      {
        id: "int-1",
        company_id: "test-co",
        integration_key: "venice",
        name: "venice",
        enabled: true,
        config: {},
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    ]);

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Misconfigured")).toBeInTheDocument();
    });

    // Should also show a validation hint
    expect(
      screen.getByText(/missing credentials/i),
    ).toBeInTheDocument();

    // Should NOT show "Connected"
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  it("shows Misconfigured for enabled integration with blank api_key", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    setIntegrationRows([
      {
        id: "int-1",
        company_id: "test-co",
        integration_key: "bankr",
        name: "bankr",
        enabled: true,
        config: { api_key: "   " },
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    ]);

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Misconfigured")).toBeInTheDocument();
    });
  });

  it("shows validation error when saving without API key (VAL-INTEGRATIONS-003)", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });

    // Open configure dialog for thirdweb
    const configureButtons = screen.getAllByText("Configure");
    fireEvent.click(configureButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Configure thirdweb")).toBeInTheDocument();
    });

    // Click Save without entering an API key
    fireEvent.click(screen.getByText("Save Configuration"));

    // Validation error should appear
    await waitFor(() => {
      expect(screen.getByText("API Key is required")).toBeInTheDocument();
    });
  });

  it("shows Misconfigured for Composio enabled without consumer_key (VAL-INTEGRATIONS-003)", async () => {
    const { IntegrationsPage } = await import("@/pages/Integrations");
    setIntegrationRows([
      {
        id: "int-c",
        company_id: "test-co",
        integration_key: "composio",
        name: "Composio",
        enabled: true,
        config: { mcp_url: "https://example.com" },
        created_at: "2024-01-01",
        updated_at: "2024-01-01",
      },
    ]);

    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("Misconfigured")).toBeInTheDocument();
    });

    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });
});
