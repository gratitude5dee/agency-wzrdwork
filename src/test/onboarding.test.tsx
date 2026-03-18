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

// ---- thirdweb/react mock ----

const mockUseActiveAccount = vi.fn();
vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWalletConnectionStatus: () => "connected",
}));

// ---- ERC-8004 identity mock (called on agent creation) ----

vi.mock("@/lib/erc8004/identity", () => ({
  createAgentIdentity: vi.fn().mockResolvedValue({}),
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

describe("OnboardingGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: clear both bypass flags so tests start from a known state
    import.meta.env.VITE_DEV_SKIP_AUTH = undefined;
    import.meta.env.VITE_DEV_SKIP_ONBOARDING = undefined;
    delete (import.meta.env as Record<string, unknown>).VITE_DEV_MOCK_WALLET;
  });

  it("renders children when VITE_DEV_SKIP_ONBOARDING is true", async () => {
    import.meta.env.VITE_DEV_SKIP_ONBOARDING = "true";

    const { OnboardingGate } = await import("@/features/onboarding/OnboardingGate");
    setupSupabaseMock();
    mockUseActiveAccount.mockReturnValue({ address: "0xABC123" });

    renderWithProviders(
      <OnboardingGate>
        <div data-testid="app-content">Main App</div>
      </OnboardingGate>,
    );

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
  });

  it("does NOT bypass onboarding when only VITE_DEV_SKIP_AUTH is true", async () => {
    import.meta.env.VITE_DEV_SKIP_AUTH = "true";
    import.meta.env.VITE_DEV_SKIP_ONBOARDING = undefined;
    import.meta.env.VITE_DEV_MOCK_WALLET = "0xMockAddr1234567890abcdef1234567890abcdef";

    const { OnboardingGate } = await import("@/features/onboarding/OnboardingGate");
    // Simulate user with no onboarding row (first visit)
    setupSupabaseMock({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    // No real wallet because auth is bypassed
    mockUseActiveAccount.mockReturnValue(null);

    renderWithProviders(
      <OnboardingGate>
        <div data-testid="app-content">Main App</div>
      </OnboardingGate>,
    );

    // Should show loading or onboarding flow, NOT bypass to children immediately
    // The gate should not render children on first paint when onboarding is not completed
    await waitFor(() => {
      // OnboardingGate should either show loading or the onboarding flow,
      // NOT the app-content (because onboarding is not completed)
      const appContent = screen.queryByTestId("app-content");
      // If onboarding data says not completed (null row), the gate should block
      // It may show "Loading…" or the OnboardingFlow, but not the main app
      expect(appContent).not.toBeInTheDocument();
    });
  });

  it("uses VITE_DEV_MOCK_WALLET as wallet address when no real wallet", async () => {
    import.meta.env.VITE_DEV_MOCK_WALLET = "0xMockAddr1234567890abcdef1234567890abcdef";
    import.meta.env.VITE_DEV_SKIP_AUTH = "true";

    const { OnboardingGate } = await import("@/features/onboarding/OnboardingGate");
    // Simulate completed onboarding for mock wallet
    setupSupabaseMock({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          wallet_address: "0xMockAddr1234567890abcdef1234567890abcdef",
          onboarding_completed: true,
          current_step: 4,
          company_id: "test-co",
        },
        error: null,
      }),
    });
    mockUseActiveAccount.mockReturnValue(null);

    renderWithProviders(
      <OnboardingGate>
        <div data-testid="app-content">Main App</div>
      </OnboardingGate>,
    );

    // With completed onboarding, children should render
    await waitFor(() => {
      expect(screen.getByTestId("app-content")).toBeInTheDocument();
    });
  });
});

describe("CompanySetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders company name input and wallet address", async () => {
    const { CompanySetup } = await import("@/features/onboarding/steps/CompanySetup");
    setupSupabaseMock();

    renderWithProviders(
      <CompanySetup walletAddress="0xTestWallet" onComplete={vi.fn()} />,
    );

    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("0xTestWallet")).toBeInTheDocument();
    expect(screen.getByText("Create Company")).toBeInTheDocument();
  });

  it("disables submit button when name is empty", async () => {
    const { CompanySetup } = await import("@/features/onboarding/steps/CompanySetup");
    setupSupabaseMock();

    renderWithProviders(
      <CompanySetup walletAddress="0xTestWallet" onComplete={vi.fn()} />,
    );

    const button = screen.getByText("Create Company");
    expect(button).toBeDisabled();
  });

  it("enables submit button when name is filled", async () => {
    const { CompanySetup } = await import("@/features/onboarding/steps/CompanySetup");
    setupSupabaseMock();

    renderWithProviders(
      <CompanySetup walletAddress="0xTestWallet" onComplete={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/company name/i), {
      target: { value: "My Company" },
    });

    const button = screen.getByText("Create Company");
    expect(button).not.toBeDisabled();
  });
});

describe("CeoAgentCreation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders agent name defaulting to CEO", async () => {
    const { CeoAgentCreation } = await import("@/features/onboarding/steps/CeoAgentCreation");
    setupSupabaseMock();

    renderWithProviders(
      <CeoAgentCreation companyId="test-co" walletAddress="0xTest" onComplete={vi.fn()} />,
    );

    const nameInput = screen.getByLabelText(/agent name/i);
    expect(nameInput).toHaveValue("CEO");
  });

  it("renders system prompt, goals, and operational parameters", async () => {
    const { CeoAgentCreation } = await import("@/features/onboarding/steps/CeoAgentCreation");
    setupSupabaseMock();

    renderWithProviders(
      <CeoAgentCreation companyId="test-co" walletAddress="0xTest" onComplete={vi.fn()} />,
    );

    expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
    expect(screen.getByText("Goals")).toBeInTheDocument();
    expect(screen.getByText("Operational Parameters")).toBeInTheDocument();
    expect(screen.getByLabelText(/spend limit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/budget cap/i)).toBeInTheDocument();
    expect(screen.getByText("Authority Level")).toBeInTheDocument();
  });

  it("has a Create CEO Agent button", async () => {
    const { CeoAgentCreation } = await import("@/features/onboarding/steps/CeoAgentCreation");
    setupSupabaseMock();

    renderWithProviders(
      <CeoAgentCreation companyId="test-co" walletAddress="0xTest" onComplete={vi.fn()} />,
    );

    expect(screen.getByText("Create CEO Agent")).toBeInTheDocument();
  });
});

describe("AgentHarnessSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders adapter cards with names and descriptions", async () => {
    const { AgentHarnessSelector } = await import(
      "@/features/onboarding/steps/AgentHarnessSelector"
    );
    setupSupabaseMock();

    renderWithProviders(
      <AgentHarnessSelector agentId="test-agent" onComplete={vi.fn()} />,
    );

    // Check that all 10 adapter cards are rendered
    expect(screen.getByText("Claude (Local)")).toBeInTheDocument();
    expect(screen.getByText("Codex (Local)")).toBeInTheDocument();
    expect(screen.getByText("Cursor")).toBeInTheDocument();
    expect(screen.getByText("Gemini (Local)")).toBeInTheDocument();
    expect(screen.getByText("OpenCode (Local)")).toBeInTheDocument();
    expect(screen.getByText("Pi (Local)")).toBeInTheDocument();
    expect(screen.getByText("OpenClaw Gateway")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("HTTP")).toBeInTheDocument();
    expect(screen.getByText("Hermes Agent")).toBeInTheDocument();
  });

  it("has a Confirm Selection button", async () => {
    const { AgentHarnessSelector } = await import(
      "@/features/onboarding/steps/AgentHarnessSelector"
    );
    setupSupabaseMock();

    renderWithProviders(
      <AgentHarnessSelector agentId="test-agent" onComplete={vi.fn()} />,
    );

    expect(screen.getByText("Confirm Selection")).toBeInTheDocument();
  });

  it("shows strengths for each adapter card", async () => {
    const { AgentHarnessSelector } = await import(
      "@/features/onboarding/steps/AgentHarnessSelector"
    );
    setupSupabaseMock();

    renderWithProviders(
      <AgentHarnessSelector agentId="test-agent" onComplete={vi.fn()} />,
    );

    // Verify some strength tags render
    expect(screen.getByText("Deep reasoning")).toBeInTheDocument();
    expect(screen.getByText("Multi-tool")).toBeInTheDocument();
  });

  it("selecting Hermes and confirming sends both adapter_type and adapter_config", async () => {
    const { AgentHarnessSelector } = await import(
      "@/features/onboarding/steps/AgentHarnessSelector"
    );
    const chain = setupSupabaseMock();
    const onComplete = vi.fn();

    renderWithProviders(
      <AgentHarnessSelector agentId="test-agent" onComplete={onComplete} />,
    );

    // Click the Hermes card
    fireEvent.click(screen.getByText("Hermes Agent"));

    // Click Confirm Selection
    fireEvent.click(screen.getByText("Confirm Selection"));

    // Verify the mutation was called with both adapter_type and adapter_config
    await waitFor(() => {
      expect(chain.update).toHaveBeenCalled();
    });

    const updateArg = chain.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.adapter_type).toBe("hermes");
    // adapter_config should be a non-empty object with Hermes-specific fields
    expect(updateArg.adapter_config).toBeDefined();
    expect(typeof updateArg.adapter_config).toBe("object");

    const config = updateArg.adapter_config as Record<string, unknown>;
    expect(config.model).toBeTruthy();
    expect(config.provider).toBeTruthy();
    expect(config.enabled_toolsets).toBeDefined();
    expect(config.memory_mode).toBeTruthy();
    expect(config.hermes_home).toBe("~/.hermes");
  });
});

describe("FeatureTour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tour with first stop (Cockpit)", async () => {
    const { FeatureTour } = await import("@/features/onboarding/steps/FeatureTour");

    renderWithProviders(<FeatureTour onComplete={vi.fn()} />);

    // "Cockpit" appears in both main card and thumbnail, so use getAllByText
    const cockpitElements = screen.getAllByText("Cockpit");
    expect(cockpitElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/mission control center/i)).toBeInTheDocument();
    expect(screen.getByText("1 of 7")).toBeInTheDocument();
  });

  it("has a Skip Tour button", async () => {
    const { FeatureTour } = await import("@/features/onboarding/steps/FeatureTour");

    renderWithProviders(<FeatureTour onComplete={vi.fn()} />);

    expect(screen.getByText("Skip Tour")).toBeInTheDocument();
  });

  it("navigates to next stop when Next is clicked", async () => {
    const { FeatureTour } = await import("@/features/onboarding/steps/FeatureTour");

    renderWithProviders(<FeatureTour onComplete={vi.fn()} />);

    fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("2 of 7")).toBeInTheDocument();
    // Dashboard description should now be visible
    expect(screen.getByText(/key metrics at a glance/i)).toBeInTheDocument();
  });

  it("calls onComplete when Skip Tour is clicked", async () => {
    const { FeatureTour } = await import("@/features/onboarding/steps/FeatureTour");
    const onComplete = vi.fn();

    renderWithProviders(<FeatureTour onComplete={onComplete} />);

    fireEvent.click(screen.getByText("Skip Tour"));

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("shows Finish Tour button on last stop", async () => {
    const { FeatureTour } = await import("@/features/onboarding/steps/FeatureTour");

    renderWithProviders(<FeatureTour onComplete={vi.fn()} />);

    // Navigate to last stop
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText("Next"));
    }

    expect(screen.getByText("7 of 7")).toBeInTheDocument();
    expect(screen.getByText("Finish Tour")).toBeInTheDocument();
  });

  it("calls onComplete when Finish Tour is clicked on last stop", async () => {
    const { FeatureTour } = await import("@/features/onboarding/steps/FeatureTour");
    const onComplete = vi.fn();

    renderWithProviders(<FeatureTour onComplete={onComplete} />);

    // Navigate to last stop
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByText("Next"));
    }

    fireEvent.click(screen.getByText("Finish Tour"));

    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("renders all 7 tour stop thumbnails", async () => {
    const { FeatureTour } = await import("@/features/onboarding/steps/FeatureTour");

    renderWithProviders(<FeatureTour onComplete={vi.fn()} />);

    // All 7 thumbnails should be rendered
    const buttons = screen.getAllByRole("button");
    // 7 thumbnails + 7 progress dots + Skip Tour + Next = many buttons
    // Just verify key labels exist as thumbnails
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});

describe("OnboardingFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders step indicator with 5 steps including skills", async () => {
    const { OnboardingFlow } = await import("@/features/onboarding/OnboardingFlow");
    setupSupabaseMock();

    renderWithProviders(<OnboardingFlow walletAddress="0xTestWallet" />);

    // Wait for the loading state to resolve (useQuery fetches onboarding state)
    await waitFor(() => {
      expect(screen.getByText("Company")).toBeInTheDocument();
    });

    expect(screen.getByText("CEO Agent")).toBeInTheDocument();
    expect(screen.getByText("Harness")).toBeInTheDocument();
    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Tour")).toBeInTheDocument();
  });

  it("shows Company Setup as first step", async () => {
    const { OnboardingFlow } = await import("@/features/onboarding/OnboardingFlow");
    setupSupabaseMock();

    renderWithProviders(<OnboardingFlow walletAddress="0xTestWallet" />);

    await waitFor(() => {
      expect(screen.getByText("Set up your company")).toBeInTheDocument();
    });

    expect(screen.getByText("Getting Started")).toBeInTheDocument();
  });
});
