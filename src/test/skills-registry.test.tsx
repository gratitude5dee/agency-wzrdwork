import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";

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
    company: { id: "test-co", name: "Test Co", slug: "test-co", wallet_address: "0xabc" },
    companyId: "test-co",
    isLoading: false,
    error: null,
  }),
}));

// ---- thirdweb mock (for AppShell-adjacent imports) ----
vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0xabc" }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useActiveWallet: () => null,
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
    delete: vi.fn().mockReturnThis(),
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

// ---- Test data ----
const MOCK_SKILLS = [
  {
    id: "skill-1",
    company_id: "test-co",
    name: "Code Generation",
    description: "Generate code across languages.",
    category: "engineering",
    enabled: true,
    prerequisite_integration: null,
    metadata: {},
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "skill-2",
    company_id: "test-co",
    name: "Web Browsing",
    description: "Navigate websites and extract data.",
    category: "tooling",
    enabled: true,
    prerequisite_integration: "composio",
    metadata: {},
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
  {
    id: "skill-3",
    company_id: "test-co",
    name: "Private Reasoning",
    description: "Use Venice private AI.",
    category: "ai",
    enabled: false,
    prerequisite_integration: "venice",
    metadata: {},
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  },
];

// ---- Tests ----

describe("Skills Registry Page (VAL-SKILLS-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Skills page heading and action buttons", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    expect(screen.getByText("Skills")).toBeInTheDocument();
    expect(screen.getByText("Import")).toBeInTheDocument();
    expect(screen.getByText("New Skill")).toBeInTheDocument();
  });

  it("renders empty state when no skills exist", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("No skills yet")).toBeInTheDocument();
    });
    expect(screen.getByText(/Import Reference Skills/)).toBeInTheDocument();
    expect(screen.getByText(/Create Skill/)).toBeInTheDocument();
  });

  it("renders skill cards when skills exist", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    // First call for skills, subsequent for integrations
    chain.order.mockResolvedValueOnce({ data: MOCK_SKILLS, error: null });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("Code Generation")).toBeInTheDocument();
    });
    expect(screen.getByText("Web Browsing")).toBeInTheDocument();
    expect(screen.getByText("Private Reasoning")).toBeInTheDocument();
  });

  it("renders enable/disable toggles for each skill", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValueOnce({ data: MOCK_SKILLS, error: null });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("Code Generation")).toBeInTheDocument();
    });
    // Each skill card has a toggle
    const toggles = screen.getAllByRole("switch");
    expect(toggles.length).toBe(MOCK_SKILLS.length);
  });

  it("renders edit buttons for each skill", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValueOnce({ data: MOCK_SKILLS, error: null });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("Code Generation")).toBeInTheDocument();
    });
    const editButtons = screen.getAllByText("Edit");
    expect(editButtons.length).toBe(MOCK_SKILLS.length);
  });

  it("opens create dialog with required form fields", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    // Wait for the page to load
    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument();
    });

    // Click 'New Skill' button in the header
    fireEvent.click(screen.getByText("New Skill"));

    await waitFor(() => {
      expect(screen.getByText("Create New Skill")).toBeInTheDocument();
    });

    // Form fields should be present
    expect(screen.getByPlaceholderText("e.g. Code Generation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/What this skill enables/)).toBeInTheDocument();
    // Dialog should have a "Create Skill" submit button
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("opens import dialog showing reference skills", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument();
    });

    // Click the "Import" button in the header
    fireEvent.click(screen.getByText("Import"));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    // Dialog title should mention import
    expect(screen.getByText(/Select skills from the reference catalog/)).toBeInTheDocument();
    // Should show reference skills in the import dialog
    expect(screen.getByText("Task Planning")).toBeInTheDocument();
  });

  it("shows prerequisite warning for skills with unmet connector dependency", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    // Skills query returns skills with prerequisites
    chain.order.mockResolvedValueOnce({ data: MOCK_SKILLS, error: null });
    // Integrations query returns empty (no integrations configured)
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("Web Browsing")).toBeInTheDocument();
    });

    // Should show a prerequisite warning badge with ⚠ composio
    const warningBadges = screen.getAllByText(/composio/i);
    expect(warningBadges.length).toBeGreaterThanOrEqual(1);
    // Find the <p> warning element that explains the prerequisite
    const warningParagraphs = screen.getAllByText(
      (_, element) => {
        if (element?.tagName !== "P") return false;
        const text = element?.textContent ?? "";
        return /requires.*composio.*integration.*configured/i.test(text);
      },
    );
    expect(warningParagraphs.length).toBeGreaterThanOrEqual(1);
  });

  it("search filters skills by name", async () => {
    const { SkillsPage } = await import("@/pages/Skills");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValueOnce({ data: MOCK_SKILLS, error: null });
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<SkillsPage />);

    await waitFor(() => {
      expect(screen.getByText("Code Generation")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search skills…");
    fireEvent.change(searchInput, { target: { value: "Code" } });

    // Only Code Generation should be visible
    expect(screen.getByText("Code Generation")).toBeInTheDocument();
    expect(screen.queryByText("Web Browsing")).not.toBeInTheDocument();
  });
});

describe("Agent Skill Assignment (VAL-SKILLS-002, VAL-SKILLS-003)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Skills section with assigned and available skills", async () => {
    const { AgentSkillAssignment } = await import("@/components/AgentSkillAssignment");
    const chain = setupSupabaseMock();
    // Skills query
    chain.order.mockResolvedValueOnce({ data: MOCK_SKILLS, error: null });
    // Agent skills query (skill-1 assigned)
    chain.order.mockResolvedValueOnce({
      data: [{ id: "as-1", agent_id: "agent-1", skill_id: "skill-1", company_id: "test-co", created_at: "2024-01-01" }],
      error: null,
    });
    // Integrations query
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<AgentSkillAssignment agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument();
    });
  });

  it("shows prerequisite warning for skills requiring unconfigured integrations", async () => {
    const { AgentSkillAssignment } = await import("@/components/AgentSkillAssignment");
    const chain = setupSupabaseMock();
    // Skills query - only a composio-dependent skill
    chain.order.mockResolvedValueOnce({
      data: [MOCK_SKILLS[1]], // Web Browsing with composio prereq
      error: null,
    });
    // Agent skills - none assigned
    chain.order.mockResolvedValueOnce({ data: [], error: null });
    // Integrations - empty (composio not configured)
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<AgentSkillAssignment agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument();
    });
    // The Web Browsing skill should be in available but disabled
    await waitFor(() => {
      const btn = screen.getByText("Web Browsing");
      expect(btn.closest("button")).toBeDisabled();
    });
  });

  it("renders link to Skills page when no company skills exist", async () => {
    const { AgentSkillAssignment } = await import("@/components/AgentSkillAssignment");
    const chain = setupSupabaseMock();
    // No skills
    chain.order.mockResolvedValue({ data: [], error: null });

    renderWithProviders(<AgentSkillAssignment agentId="agent-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No skills configured/)).toBeInTheDocument();
    });
    expect(screen.getByText("Skills page")).toBeInTheDocument();
  });
});

describe("Onboarding Skill Selection (VAL-SKILLS-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders skill selection step with heading", async () => {
    const { SkillSelection } = await import("@/features/onboarding/steps/SkillSelection");
    const chain = setupSupabaseMock();
    // Skills and integrations queries
    chain.order.mockResolvedValue({ data: MOCK_SKILLS, error: null });

    const onComplete = vi.fn();
    renderWithProviders(
      <SkillSelection agentId="agent-1" companyId="test-co" onComplete={onComplete} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Select skills for your CEO agent")).toBeInTheDocument();
    });
  });

  it("renders import button when no skills exist", async () => {
    const { SkillSelection } = await import("@/features/onboarding/steps/SkillSelection");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: [], error: null });

    const onComplete = vi.fn();
    renderWithProviders(
      <SkillSelection agentId="agent-1" companyId="test-co" onComplete={onComplete} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Import Reference Skills")).toBeInTheDocument();
    });
  });

  it("shows skip and continue buttons", async () => {
    const { SkillSelection } = await import("@/features/onboarding/steps/SkillSelection");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: MOCK_SKILLS, error: null });

    const onComplete = vi.fn();
    renderWithProviders(
      <SkillSelection agentId="agent-1" companyId="test-co" onComplete={onComplete} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Skip")).toBeInTheDocument();
    });
    expect(screen.getByText("Continue Without Skills")).toBeInTheDocument();
  });

  it("calls onComplete when skip is clicked", async () => {
    const { SkillSelection } = await import("@/features/onboarding/steps/SkillSelection");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: MOCK_SKILLS, error: null });

    const onComplete = vi.fn();
    renderWithProviders(
      <SkillSelection agentId="agent-1" companyId="test-co" onComplete={onComplete} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Skip")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Skip"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("skill cards are selectable with visual feedback", async () => {
    const { SkillSelection } = await import("@/features/onboarding/steps/SkillSelection");
    const chain = setupSupabaseMock();
    chain.order.mockResolvedValue({ data: MOCK_SKILLS, error: null });

    const onComplete = vi.fn();
    renderWithProviders(
      <SkillSelection agentId="agent-1" companyId="test-co" onComplete={onComplete} />,
    );

    await waitFor(() => {
      expect(screen.getByText("Code Generation")).toBeInTheDocument();
    });

    // Click on Code Generation card
    fireEvent.click(screen.getByText("Code Generation"));

    // Button text should update to reflect selection count
    await waitFor(() => {
      expect(screen.getByText("Assign 1 Skill")).toBeInTheDocument();
    });
  });
});

describe("Skills route in navigation", () => {
  it("Skills nav link exists in COMPANY_ITEMS", async () => {
    const { COMPANY_ITEMS } = await import("@/features/cockpit/components/AppShell");
    const skillsItem = COMPANY_ITEMS.find((item) => item.to === "/skills");
    expect(skillsItem).toBeDefined();
    expect(skillsItem?.label).toBe("Skills");
  });
});

describe("Reference skills catalog", () => {
  it("REFERENCE_SKILLS contains expected entries", async () => {
    const { REFERENCE_SKILLS } = await import("@/hooks/useSkills");
    expect(REFERENCE_SKILLS.length).toBeGreaterThanOrEqual(10);

    // Check that connector-dependent skills have prerequisites
    const webBrowsing = REFERENCE_SKILLS.find((s) => s.name === "Web Browsing");
    expect(webBrowsing).toBeDefined();
    expect(webBrowsing?.prerequisite_integration).toBe("composio");

    const privateReasoning = REFERENCE_SKILLS.find((s) => s.name === "Private Reasoning");
    expect(privateReasoning).toBeDefined();
    expect(privateReasoning?.prerequisite_integration).toBe("venice");

    // Non-connector skills should have no prerequisite
    const codegen = REFERENCE_SKILLS.find((s) => s.name === "Code Generation");
    expect(codegen).toBeDefined();
    expect(codegen?.prerequisite_integration).toBeUndefined();
  });
});
