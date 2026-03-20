import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { KanbanPanel } from "@/features/cockpit/delegation/components/KanbanPanel";

/* ── Chain-style mock helpers (match Supabase client interface) ── */

const MOCK_AGENTS = [
  { id: "agent-1", name: "Runtime Engineer", company_id: "c1" },
  { id: "agent-2", name: "QA Lead", company_id: "c1" },
];

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
    assignee_agent_id: "agent-1",
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
    assignee_agent_id: "agent-2",
    project_id: null,
  },
  {
    id: "issue-foreign",
    identifier: "FOREIGN-1",
    title: "Foreign company issue",
    status: "todo",
    priority: "low",
    company_id: "c-other",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: null,
    assignee_agent_id: null,
    project_id: null,
  },
];

function makeChainMock(table: string) {
  const eqValues: Record<string, string> = {};

  function applyFilter<T extends Record<string, unknown>>(data: T[]): T[] {
    let result = data;
    if (eqValues.company_id) {
      result = result.filter((r) => r.company_id === eqValues.company_id);
    }
    return result;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, (...args: unknown[]) => unknown> = {} as any;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn((col: unknown, val: unknown) => {
    eqValues[col as string] = val as string;
    return chain;
  });
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.single = vi.fn(() => chain);

  // Make the chain thenable so React Query can await it
  chain.then = (_resolve: (value: { data: unknown[]; error: null }) => void) => {
    let rows: unknown[] = [];
    if (table === "issues") rows = applyFilter(MOCK_ISSUES);
    else if (table === "agents") rows = applyFilter(MOCK_AGENTS);
    _resolve({ data: rows, error: null });
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

describe("KanbanPanel — live company-scoped data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders seven workflow columns from live company-scoped data", async () => {
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

    for (const label of expectedColumns) {
      expect(await screen.findByText(label)).toBeInTheDocument();
    }
  });

  it("displays assignee name when agent is assigned", async () => {
    renderWithProviders(<KanbanPanel />);

    // Wait for data
    expect(await screen.findByText("ACM-1")).toBeInTheDocument();

    // Issue-1 is assigned to agent-1 (Runtime Engineer)
    expect(screen.getByText("Runtime Engineer")).toBeInTheDocument();
  });

  it("shows explicit unassigned state when no agent is assigned", async () => {
    renderWithProviders(<KanbanPanel />);

    await screen.findByText("ACM-2");

    // Issue-2 has no assignee — should show "Unassigned"
    expect(screen.getByText(/unassigned/i)).toBeInTheDocument();
  });

  it("excludes foreign-company issues from the board", async () => {
    renderWithProviders(<KanbanPanel />);

    await screen.findByText("ACM-1");

    // The foreign issue should not appear
    expect(screen.queryByText("FOREIGN-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Foreign company issue")).not.toBeInTheDocument();
  });

  it("can collapse and expand the panel", async () => {
    renderWithProviders(<KanbanPanel />);

    await screen.findByText("ACM-1");

    const toggleButton = screen.getByRole("button", { name: /kanban/i });
    fireEvent.click(toggleButton);
    expect(screen.queryByText("Backlog")).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(await screen.findByText("Backlog")).toBeInTheDocument();
  });
});
