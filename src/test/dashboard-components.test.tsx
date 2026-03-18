import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { MetricCard } from "@/components/MetricCard";
import { ActiveAgentsPanel } from "@/components/ActiveAgentsPanel";
import {
  ChartCard,
  RunActivityChart,
  PriorityChart,
  IssueStatusChart,
  SuccessRateChart,
  getLast14Days,
} from "@/components/ActivityCharts";
import { Bot, CircleDot } from "lucide-react";

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

/* ---- MetricCard ---- */

describe("MetricCard", () => {
  it("renders label, value, and icon", () => {
    renderWithProviders(
      <MetricCard icon={Bot} value={42} label="Agents" />,
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Agents")).toBeInTheDocument();
  });

  it("renders as a link when 'to' is provided", () => {
    renderWithProviders(
      <MetricCard icon={Bot} value={5} label="Agents" to="/org" />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/org");
  });

  it("renders description when provided", () => {
    renderWithProviders(
      <MetricCard
        icon={CircleDot}
        value={10}
        label="Open Issues"
        description={<span>3 in progress, 2 blocked</span>}
      />,
    );
    expect(screen.getByText("3 in progress, 2 blocked")).toBeInTheDocument();
  });

  it("renders trend indicator when provided", () => {
    const { container } = renderWithProviders(
      <MetricCard icon={Bot} value={7} label="Agents" trend="up" />,
    );
    // TrendingUp icon should be present
    const svg = container.querySelector("svg.lucide-trending-up");
    expect(svg).toBeInTheDocument();
  });
});

/* ---- ActiveAgentsPanel ---- */

describe("ActiveAgentsPanel", () => {
  const agents = [
    { id: "a1", name: "CEO", role: "ceo", title: "Chief Executive", status: "running", adapter_type: "claude_local" },
    { id: "a2", name: "Engineer", role: "engineer", title: "Senior Dev", status: "active", adapter_type: "codex_local" },
    { id: "a3", name: "Idle Agent", role: "analyst", title: null, status: "paused", adapter_type: "process" },
  ];

  it("renders only active/running agents", () => {
    renderWithProviders(<ActiveAgentsPanel agents={agents} />);
    expect(screen.getByText("CEO")).toBeInTheDocument();
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.queryByText("Idle Agent")).not.toBeInTheDocument();
  });

  it("shows empty state when no active agents", () => {
    renderWithProviders(
      <ActiveAgentsPanel agents={[{ id: "a1", name: "Paused", role: "x", title: null, status: "paused", adapter_type: "process" }]} />,
    );
    expect(screen.getByText("No active agents.")).toBeInTheDocument();
  });

  it("shows no-agents empty state when agent list is empty", () => {
    renderWithProviders(<ActiveAgentsPanel agents={[]} />);
    expect(screen.getByText(/No agents yet/)).toBeInTheDocument();
  });

  it("displays agent status and adapter type", () => {
    renderWithProviders(<ActiveAgentsPanel agents={agents} />);
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();
  });

  it("renders agent cards as links to agent detail", () => {
    renderWithProviders(<ActiveAgentsPanel agents={agents} />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/agents/a1");
    expect(hrefs).toContain("/agents/a2");
  });
});

/* ---- ActivityCharts ---- */

describe("ActivityCharts", () => {
  it("getLast14Days returns 14 date strings", () => {
    const days = getLast14Days();
    expect(days).toHaveLength(14);
    // Each should be YYYY-MM-DD
    for (const d of days) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("ChartCard renders title and subtitle", () => {
    renderWithProviders(
      <ChartCard title="Test Chart" subtitle="Last 14 days">
        <p>chart body</p>
      </ChartCard>,
    );
    expect(screen.getByText("Test Chart")).toBeInTheDocument();
    expect(screen.getByText("Last 14 days")).toBeInTheDocument();
    expect(screen.getByText("chart body")).toBeInTheDocument();
  });

  describe("RunActivityChart", () => {
    it("shows empty message when no runs", () => {
      renderWithProviders(<RunActivityChart runs={[]} />);
      expect(screen.getByText("No runs yet")).toBeInTheDocument();
    });

    it("renders bars when runs exist", () => {
      const today = new Date().toISOString().slice(0, 10);
      const runs = [
        { status: "succeeded", createdAt: `${today}T10:00:00Z` },
        { status: "failed", createdAt: `${today}T11:00:00Z` },
      ];
      const { container } = renderWithProviders(<RunActivityChart runs={runs} />);
      const barsContainer = container.querySelector('[data-testid="run-activity-bars"]');
      expect(barsContainer).toBeInTheDocument();
      // Should have 14 day columns
      expect(barsContainer!.children).toHaveLength(14);
    });
  });

  describe("PriorityChart", () => {
    it("shows empty message when no issues", () => {
      renderWithProviders(<PriorityChart issues={[]} />);
      expect(screen.getByText("No issues")).toBeInTheDocument();
    });

    it("renders bars when issues exist", () => {
      const today = new Date().toISOString().slice(0, 10);
      const issues = [
        { status: "todo", priority: "high", createdAt: `${today}T10:00:00Z` },
        { status: "in_progress", priority: "critical", createdAt: `${today}T11:00:00Z` },
      ];
      const { container } = renderWithProviders(<PriorityChart issues={issues} />);
      const barsContainer = container.querySelector('[data-testid="priority-bars"]');
      expect(barsContainer).toBeInTheDocument();
    });
  });

  describe("IssueStatusChart", () => {
    it("shows empty message when no issues", () => {
      renderWithProviders(<IssueStatusChart issues={[]} />);
      expect(screen.getByText("No issues")).toBeInTheDocument();
    });

    it("renders bars when issues exist", () => {
      const today = new Date().toISOString().slice(0, 10);
      const issues = [
        { status: "todo", priority: "medium", createdAt: `${today}T10:00:00Z` },
        { status: "blocked", priority: "high", createdAt: `${today}T11:00:00Z` },
      ];
      const { container } = renderWithProviders(<IssueStatusChart issues={issues} />);
      const barsContainer = container.querySelector('[data-testid="issue-status-bars"]');
      expect(barsContainer).toBeInTheDocument();
    });
  });

  describe("SuccessRateChart", () => {
    it("shows empty message when no runs", () => {
      renderWithProviders(<SuccessRateChart runs={[]} />);
      expect(screen.getByText("No runs yet")).toBeInTheDocument();
    });

    it("renders bars when runs exist", () => {
      const today = new Date().toISOString().slice(0, 10);
      const runs = [
        { status: "succeeded", createdAt: `${today}T10:00:00Z` },
        { status: "succeeded", createdAt: `${today}T11:00:00Z` },
        { status: "failed", createdAt: `${today}T12:00:00Z` },
      ];
      const { container } = renderWithProviders(<SuccessRateChart runs={runs} />);
      const barsContainer = container.querySelector('[data-testid="success-rate-bars"]');
      expect(barsContainer).toBeInTheDocument();
    });
  });
});

/* ---- Dashboard Integration (SectionPage with mocked data) ---- */

const now = new Date().toISOString();

vi.mock("@/hooks/useDashboardMetrics", () => ({
  useAgentMetrics: () => ({ data: { total: 2, running: 1, active: 1 }, isLoading: false }),
  useIssueMetrics: () => ({ data: { open: 2, inProgress: 1, blocked: 1 }, isLoading: false }),
  useRunMetrics: () => ({ data: { live: 1, succeeded: 0, failed: 0 }, isLoading: false }),
  useApprovalMetrics: () => ({ data: 1, isLoading: false }),
}));

vi.mock("@/hooks/useDashboardData", () => ({
  useDashboardRuns: () => ({
    data: [
      { id: "r1", status: "running", created_at: now },
    ],
    isLoading: false,
  }),
  useDashboardIssues: () => ({
    data: [
      { id: "i1", identifier: "ACM-1", title: "Fix bug", status: "blocked", priority: "high", assignee_agent_id: "a1", created_at: now, updated_at: now },
      { id: "i2", identifier: "ACM-2", title: "Add feature", status: "in_progress", priority: "medium", assignee_agent_id: "a2", created_at: now, updated_at: now },
    ],
    isLoading: false,
  }),
  useDashboardAgents: () => ({
    data: [
      { id: "a1", name: "CEO", role: "ceo", title: "Chief Executive", status: "running", adapter_type: "claude_local" },
      { id: "a2", name: "Engineer", role: "engineer", title: null, status: "active", adapter_type: "codex_local" },
    ],
    isLoading: false,
  }),
  useDashboardActivity: () => ({
    data: [
      { id: "act1", agent_id: "a1", issue_id: "i1", action: "run.started", details: "Started deploy", created_at: now },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/features/cockpit/lib/useAgencyData", () => ({
  useAgencyData: () => ({
    snapshot: {
      company: { id: "c1", name: "Test", slug: "test", companyType: "startup", description: "", brief: "", brandColor: "#000", createdAt: "", updatedAt: "" },
      agents: [],
      projects: [],
      goals: [],
      issues: [],
      approvals: [],
      runs: [],
      activity: [],
      source: "supabase",
    },
    isLoading: false,
  }),
}));

describe("Dashboard integration", () => {

  it("renders metric cards with real counts on dashboard", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    // Agents count (value=2) and Open Issues (value=2) both show "2"
    const twos = screen.getAllByText("2");
    expect(twos.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Agents")).toBeInTheDocument();

    // Open Issues count (both are open — blocked and in_progress)
    expect(screen.getByText("Open Issues")).toBeInTheDocument();

    // Live runs
    expect(screen.getByText("Live Runs")).toBeInTheDocument();

    // Pending Approvals (value=1)
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Pending Approvals")).toBeInTheDocument();
  });

  it("renders MetricCard links to respective pages", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));

    expect(hrefs).toContain("/org");
    expect(hrefs).toContain("/issues");
    expect(hrefs).toContain("/cockpit");
    expect(hrefs).toContain("/approvals");
  });

  it("renders active agents panel with live data", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    expect(screen.getByText("Active Agents")).toBeInTheDocument();
    // CEO appears in both the agents panel and in the activity feed agent label
    expect(screen.getAllByText("CEO").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Engineer")).toBeInTheDocument();
  });

  it("renders activity charts section", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    expect(screen.getByText("Run Activity")).toBeInTheDocument();
    expect(screen.getByText("Issues by Priority")).toBeInTheDocument();
    expect(screen.getByText("Issues by Status")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
  });

  it("renders recent activity feed from live data", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("run started")).toBeInTheDocument();
  });

  it("renders urgent/blocked issues from live data", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    expect(screen.getByText("Urgent / Blocked Issues")).toBeInTheDocument();
    // The blocked issue should appear with its identifier
    expect(screen.getByText("ACM-1")).toBeInTheDocument();
  });

  it("shows metric description text for each card", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    // Agent metrics description
    expect(screen.getByText(/1 running/)).toBeInTheDocument();
    // Issue metrics description
    expect(screen.getByText(/1 in progress/)).toBeInTheDocument();
    // Approval description
    expect(screen.getByText("Awaiting review")).toBeInTheDocument();
  });

  it("does not show demo mode banner when source is supabase", async () => {
    const { SectionPage } = await import("@/features/cockpit/pages/SectionPage");
    renderWithProviders(<SectionPage section="dashboard" />);

    expect(screen.queryByTestId("demo-mode-banner")).not.toBeInTheDocument();
  });
});
