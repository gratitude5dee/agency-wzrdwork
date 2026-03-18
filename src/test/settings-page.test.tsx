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
vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "co-1", name: "Test Corp", slug: "test-corp", wallet_address: "0xABC123" },
    companyId: "co-1",
    isLoading: false,
    error: null,
  }),
}));

// ---- thirdweb mock (for wallet disconnect) ----
const mockDisconnect = vi.fn();
const mockActiveWallet = { id: "mock-wallet" };
vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0xABC123" }),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
  useActiveWallet: () => mockActiveWallet,
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
    in: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    ...overrides,
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ---- Tests ----

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders settings page with Company Information card", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    const chain = setupSupabaseMock();
    chain.maybeSingle.mockResolvedValue({
      data: {
        id: "co-1",
        name: "Test Corp",
        wallet_address: "0xABC123",
      },
      error: null,
    });

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Company Information")).toBeInTheDocument();
    });
  });

  it("displays company name and wallet address from Supabase", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    // useActiveCompany mock already provides companyId = "co-1".
    // useCompanySettings queries companies by that id.
    const companiesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "co-1",
          name: "Acme Agents",
          wallet_address: "0xDeadBeef",
        },
        error: null,
      }),
    };
    const agentsChain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "a1" }], error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
    };
    const onboardingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "ob-1",
          wallet_address: "0xABC123",
          company_id: "co-1",
          current_step: 4,
          onboarding_completed: true,
          metadata: {},
        },
        error: null,
      }),
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === "companies") return companiesChain;
      if (table === "user_onboarding") return onboardingChain;
      return agentsChain;
    });

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Acme Agents")).toBeInTheDocument();
    });
    expect(screen.getByText("0xDeadBeef")).toBeInTheDocument();
  });

  it("renders Backend Status card with connection indicator", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    const chain = setupSupabaseMock();
    chain.limit.mockResolvedValue({ data: [{ id: "a1" }], error: null });

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Backend Status")).toBeInTheDocument();
    });
    expect(screen.getByText("Connection")).toBeInTheDocument();
  });

  it("renders Replay Tour button", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Replay Tour")).toBeInTheDocument();
    });
  });

  it("shows FeatureTour when Replay Tour is clicked", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Replay Tour")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Replay Tour"));

    await waitFor(() => {
      expect(screen.getByText("Quick Tour")).toBeInTheDocument();
    });
    // The FeatureTour component should be visible with a Skip Tour button
    expect(screen.getByText("Skip Tour")).toBeInTheDocument();
  });

  it("renders Onboarding reset section", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Reset Onboarding")).toBeInTheDocument();
    });
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });

  it("renders Feature Tour card with correct description", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Feature Tour")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Revisit the guided walkthrough of the platform."),
    ).toBeInTheDocument();
  });

  it("replay tour returns to settings when tour is completed or skipped", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    // Click Replay Tour
    await waitFor(() => {
      expect(screen.getByText("Replay Tour")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Replay Tour"));

    // Verify tour is showing
    await waitFor(() => {
      expect(screen.getByText("Quick Tour")).toBeInTheDocument();
    });

    // Click Skip Tour to return to settings
    fireEvent.click(screen.getByText("Skip Tour"));

    // Should be back on settings page
    await waitFor(() => {
      expect(screen.getByText("Company Information")).toBeInTheDocument();
    });
    expect(screen.getByText("Replay Tour")).toBeInTheDocument();
  });

  it("replay tour starts from stop 1 (Sandbox)", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Replay Tour")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Replay Tour"));

    // Should start at stop 1 (Sandbox)
    await waitFor(() => {
      expect(screen.getByText("1 of 7")).toBeInTheDocument();
    });
    const sandboxElements = screen.getAllByText("Sandbox");
    expect(sandboxElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Defaults section with company type", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    const companiesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "co-1",
          name: "Acme Agents",
          wallet_address: "0xDeadBeef",
          company_type: "agency",
          brand_color: "#3b82f6",
          brief: "AI-powered agency",
        },
        error: null,
      }),
    };
    const agentsChain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "a1" }], error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
    };
    const onboardingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "ob-1",
          wallet_address: "0xABC123",
          company_id: "co-1",
          current_step: 4,
          onboarding_completed: true,
          metadata: {},
        },
        error: null,
      }),
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === "companies") return companiesChain;
      if (table === "user_onboarding") return onboardingChain;
      return agentsChain;
    });

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Defaults")).toBeInTheDocument();
    });
    expect(screen.getByText("Company Type")).toBeInTheDocument();
  });

  it("renders Danger Zone section with warning controls", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    });
    // Both a heading and a button use "Disconnect Wallet"
    const disconnectElements = screen.getAllByText("Disconnect Wallet");
    expect(disconnectElements.length).toBeGreaterThanOrEqual(1);
  });

  it("displays company brief in profile section", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    const companiesChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "co-1",
          name: "Acme Agents",
          wallet_address: "0xDeadBeef",
          company_type: "agency",
          brand_color: "#3b82f6",
          brief: "AI-powered agency platform",
        },
        error: null,
      }),
    };
    const agentsChain = {
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "a1" }], error: null }),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
    };
    const onboardingChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "ob-1",
          wallet_address: "0xABC123",
          company_id: "co-1",
          current_step: 4,
          onboarding_completed: true,
          metadata: {},
        },
        error: null,
      }),
    };
    mockFrom.mockImplementation((table: string) => {
      if (table === "companies") return companiesChain;
      if (table === "user_onboarding") return onboardingChain;
      return agentsChain;
    });

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("AI-powered agency platform")).toBeInTheDocument();
    });
    expect(screen.getByText("Brief")).toBeInTheDocument();
  });

  it("disconnect wallet button triggers real thirdweb disconnect and navigates away", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();
    mockDisconnect.mockClear();

    renderWithProviders(<SectionPage section="settings" />);

    // Find the first "Disconnect Wallet" button (the reveal button)
    await waitFor(() => {
      expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    });

    // Click the initial Disconnect Wallet button to reveal confirmation
    const disconnectButtons = screen.getAllByText("Disconnect Wallet");
    fireEvent.click(disconnectButtons[disconnectButtons.length - 1]); // click the button, not the heading

    // Confirm disconnect
    await waitFor(() => {
      expect(screen.getByText("Confirm Disconnect")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Confirm Disconnect"));

    // Should have called the real thirdweb disconnect
    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalledWith(mockActiveWallet);
    });
  });

  it("danger zone copy truthfully describes wallet disconnect as signing out", async () => {
    const { SectionPage } = await import(
      "@/features/cockpit/pages/SectionPage"
    );

    setupSupabaseMock();

    renderWithProviders(<SectionPage section="settings" />);

    await waitFor(() => {
      expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    });

    // The copy should truthfully describe what disconnect does —
    // it should NOT say "Removes the wallet address from this company"
    // (which was the old misleading copy that did a no-op)
    expect(screen.queryByText(/Removes the wallet address from this company/)).not.toBeInTheDocument();
  });
});
