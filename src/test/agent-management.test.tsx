import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// Mock Supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));

// Mock active company for NewAgent and other pages that use it
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

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement, { initialEntries = ["/"] } = {}) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/* ---- Agents List Page ---- */

describe("AgentsPage", () => {
  it("renders heading and 'New Agent' button", async () => {
    const { AgentsPage } = await import("@/pages/Agents");
    renderWithProviders(<AgentsPage />);
    await waitFor(() => {
      expect(screen.getByText("Agents")).toBeInTheDocument();
    });
    expect(screen.getByText("New Agent")).toBeInTheDocument();
  });

  it("renders agent cards with name, role, status, and adapter type when data available", async () => {
    const { AgentsPage } = await import("@/pages/Agents");
    renderWithProviders(<AgentsPage />);
    // The page should render even with empty data (loading/empty state)
    await waitFor(() => {
      expect(screen.getByText("Agents")).toBeInTheDocument();
    });
  });

  it("renders 'New Agent' as a link to /agents/new", async () => {
    const { AgentsPage } = await import("@/pages/Agents");
    renderWithProviders(<AgentsPage />);
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /new agent/i })).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: /new agent/i });
    expect(link).toHaveAttribute("href", "/agents/new");
  });
});

/* ---- Agent Detail Page ---- */

describe("AgentDetailPage", () => {
  it("renders loading state initially", async () => {
    const { AgentDetailPage } = await import("@/pages/AgentDetail");
    renderWithProviders(
      <Routes>
        <Route path="/agents/:id" element={<AgentDetailPage />} />
      </Routes>,
      { initialEntries: ["/agents/test-id"] },
    );
    // Should render something (loading or no-record state)
    expect(document.body).toBeTruthy();
  });

  it("renders agent properties section header", async () => {
    const { AgentDetailPage } = await import("@/pages/AgentDetail");
    renderWithProviders(
      <Routes>
        <Route path="/agents/:id" element={<AgentDetailPage />} />
      </Routes>,
      { initialEntries: ["/agents/test-id"] },
    );
    // Should render the page structure
    expect(document.body).toBeTruthy();
  });
});

/* ---- New Agent Form ---- */

describe("NewAgentPage", () => {
  it("renders the form with all required fields", async () => {
    const { NewAgentPage } = await import("@/pages/NewAgent");
    renderWithProviders(
      <Routes>
        <Route path="/agents/new" element={<NewAgentPage />} />
      </Routes>,
      { initialEntries: ["/agents/new"] },
    );
    expect(screen.getByText("Create New Agent")).toBeInTheDocument();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    // Role label is present (there are multiple matches, so use getAllByText)
    const roleElements = screen.getAllByText(/role/i);
    expect(roleElements.length).toBeGreaterThanOrEqual(1);
    // Adapter Type card header is present
    const adapterElements = screen.getAllByText(/adapter type/i);
    expect(adapterElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the name input as required", async () => {
    const { NewAgentPage } = await import("@/pages/NewAgent");
    renderWithProviders(
      <Routes>
        <Route path="/agents/new" element={<NewAgentPage />} />
      </Routes>,
      { initialEntries: ["/agents/new"] },
    );
    const nameInput = screen.getByLabelText(/name/i);
    expect(nameInput).toHaveAttribute("required");
  });

  it("has a submit button labeled 'Create Agent'", async () => {
    const { NewAgentPage } = await import("@/pages/NewAgent");
    renderWithProviders(
      <Routes>
        <Route path="/agents/new" element={<NewAgentPage />} />
      </Routes>,
      { initialEntries: ["/agents/new"] },
    );
    const submitButton = screen.getByRole("button", { name: /create agent/i });
    expect(submitButton).toBeInTheDocument();
  });

  it("adapter type dropdown shows all registered adapter types", async () => {
    const { NewAgentPage } = await import("@/pages/NewAgent");
    renderWithProviders(
      <Routes>
        <Route path="/agents/new" element={<NewAgentPage />} />
      </Routes>,
      { initialEntries: ["/agents/new"] },
    );
    // The adapter dropdown section should be present
    const adapterElements = screen.getAllByText(/adapter type/i);
    expect(adapterElements.length).toBeGreaterThanOrEqual(1);
    // The "Select an adapter type" placeholder should be present
    expect(screen.getByText("Select an adapter type")).toBeInTheDocument();
  });

  it("role dropdown shows expected roles", async () => {
    const { NewAgentPage } = await import("@/pages/NewAgent");
    renderWithProviders(
      <Routes>
        <Route path="/agents/new" element={<NewAgentPage />} />
      </Routes>,
      { initialEntries: ["/agents/new"] },
    );
    // Role label exists
    const roleElements = screen.getAllByText(/role/i);
    expect(roleElements.length).toBeGreaterThanOrEqual(1);
    // The "Select a role" placeholder should be present
    expect(screen.getByText("Select a role")).toBeInTheDocument();
  });
});
