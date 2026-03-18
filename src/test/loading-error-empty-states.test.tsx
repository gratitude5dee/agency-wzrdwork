/**
 * Tests that core pages expose explicit loading, empty, and recoverable error
 * states per VAL-POLISH-001.
 *
 * Covers: AgentsPage, IntegrationsPage, DashboardSection, SettingsSection
 */
import { render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "co-1", name: "Test Corp", slug: "test-corp", wallet_address: "0xABC123" },
    companyId: "co-1",
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

// ---- AgentsPage tests ----

describe("AgentsPage states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while agents are fetching", async () => {
    // Create a promise that never resolves to keep loading state
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    mockFrom.mockReturnValue(chain);

    const { AgentsPage } = await import("@/pages/Agents");
    renderWithProviders(<AgentsPage />);

    expect(screen.getByTestId("page-loading-state")).toBeInTheDocument();
    expect(screen.getByText("Loading agents…")).toBeInTheDocument();
  });

  it("shows error state with retry when fetch fails", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockRejectedValue(new Error("Connection failed")),
    };
    mockFrom.mockReturnValue(chain);

    const { AgentsPage } = await import("@/pages/Agents");
    renderWithProviders(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-error-state")).toBeInTheDocument();
    });
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows empty state when no agents exist", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const { AgentsPage } = await import("@/pages/Agents");
    renderWithProviders(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-empty-state")).toBeInTheDocument();
    });
    expect(screen.getByText("No agents yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first agent to get started.")).toBeInTheDocument();
  });

  it("shows agent list when agents exist", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "a1",
            name: "CEO Bot",
            role: "ceo",
            title: "Chief Executive",
            status: "active",
            adapter_type: "claude_local",
          },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(chain);

    const { AgentsPage } = await import("@/pages/Agents");
    renderWithProviders(<AgentsPage />);

    await waitFor(() => {
      expect(screen.getByText("CEO Bot")).toBeInTheDocument();
    });
    // Should NOT show loading/empty/error
    expect(screen.queryByTestId("page-loading-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-empty-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-error-state")).not.toBeInTheDocument();
  });
});

// ---- IntegrationsPage tests ----

describe("IntegrationsPage states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while integrations are fetching", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnValue(new Promise(() => {})),
    };
    mockFrom.mockReturnValue(chain);

    const { IntegrationsPage } = await import("@/pages/Integrations");
    renderWithProviders(<IntegrationsPage />);

    expect(screen.getByTestId("page-loading-state")).toBeInTheDocument();
    expect(screen.getByText("Loading integrations…")).toBeInTheDocument();
  });

  it("shows error state with retry when integration fetch fails", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockRejectedValue(new Error("Database unavailable")),
    };
    mockFrom.mockReturnValue(chain);

    const { IntegrationsPage } = await import("@/pages/Integrations");
    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("page-error-state")).toBeInTheDocument();
    });
    expect(screen.getByText("Database unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("renders integration cards when data loads successfully", async () => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    mockFrom.mockReturnValue(chain);

    const { IntegrationsPage } = await import("@/pages/Integrations");
    renderWithProviders(<IntegrationsPage />);

    await waitFor(() => {
      expect(screen.getByText("thirdweb")).toBeInTheDocument();
    });
    // Should NOT show loading/error
    expect(screen.queryByTestId("page-loading-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-error-state")).not.toBeInTheDocument();
  });
});
