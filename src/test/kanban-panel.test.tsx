import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { KanbanPanel } from "@/features/cockpit/delegation/components/KanbanPanel";

/* ── Chain-style Supabase mock ── */

const MOCK_ISSUES = [
  {
    id: "issue-1",
    identifier: "ACM-1",
    title: "Create heartbeat",
    status: "backlog",
    priority: "high",
    company_id: "c1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: null,
    assignee_agent_id: null,
    project_id: null,
  },
  {
    id: "issue-2",
    identifier: "ACM-2",
    title: "Wire dark shell",
    status: "in_progress",
    priority: "medium",
    company_id: "c1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: null,
    assignee_agent_id: null,
    project_id: null,
  },
  {
    id: "issue-3",
    identifier: "ACM-3",
    title: "Fix blocked bug",
    status: "blocked",
    priority: "critical",
    company_id: "c1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: null,
    assignee_agent_id: null,
    project_id: null,
  },
];

function makeChainMock(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, (...args: unknown[]) => unknown> = {} as any;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);
  chain.then = (resolve: (value: { data: unknown[]; error: null }) => void) => {
    const rows = table === "issues" ? MOCK_ISSUES : [];
    resolve({ data: rows, error: null });
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn((table: string) => makeChainMock(table)),
  },
}));

vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "c1", name: "Test Co", slug: "test-co", wallet_address: "0x123" },
    companyId: "c1",
    isLoading: false,
    error: null,
  }),
}));

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0x123" }),
}));

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
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("KanbanPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 7 status columns", async () => {
    renderWithProviders(<KanbanPanel />);

    const expectedColumns = [
      "Backlog",
      "Todo",
      "In Progress",
      "In Review",
      "Blocked",
      "Done",
      "Cancelled",
    ];

    // Wait for columns to appear
    for (const label of expectedColumns) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });

  it("displays issue cards with correct data", async () => {
    renderWithProviders(<KanbanPanel />);

    // Wait for identifiers to appear
    expect(await screen.findByText("ACM-1")).toBeInTheDocument();
    expect(screen.getByText("ACM-2")).toBeInTheDocument();
    expect(screen.getByText("ACM-3")).toBeInTheDocument();

    // Titles
    expect(screen.getByText("Create heartbeat")).toBeInTheDocument();
    expect(screen.getByText("Wire dark shell")).toBeInTheDocument();
    expect(screen.getByText("Fix blocked bug")).toBeInTheDocument();
  });

  it("renders priority badges on cards", async () => {
    renderWithProviders(<KanbanPanel />);

    // Wait for content to load
    await screen.findByText("ACM-1");

    // Priority badges should exist
    expect(screen.getByText("high")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("can collapse and expand the panel", async () => {
    renderWithProviders(<KanbanPanel />);

    // Wait for content to be loaded
    await screen.findByText("ACM-1");

    // Find the collapse toggle button
    const toggleButton = screen.getByRole("button", { name: /kanban/i });
    expect(toggleButton).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(toggleButton);

    // When collapsed, column headers should not be visible
    expect(screen.queryByText("Backlog")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(toggleButton);

    // When expanded, columns should be visible again
    expect(await screen.findByText("Backlog")).toBeInTheDocument();
  });

  it("shows the section header with title", () => {
    renderWithProviders(<KanbanPanel />);

    // The header should show "Kanban" or similar
    expect(screen.getByText(/kanban/i)).toBeInTheDocument();
  });
});
