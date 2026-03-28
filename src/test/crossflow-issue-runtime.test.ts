/**
 * VAL-CROSS-003: Issue assignment produces a coherent issue and execution trail
 *
 * Tests that creating and assigning an issue yields a consistent trail
 * across issue surfaces, Kanban, activity, run, approval, and execution
 * log artifacts — all sharing the same issue identifier.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

/* ---------- Supabase mock ---------- */

const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

/* ---------- Fixtures ---------- */

const COMPANY_ID = "company-cross-003";
const AGENT_ID = "agent-cross-003";
const ISSUE_ID = "issue-cross-003";
const RUN_ID = "run-cross-003";

const ISSUE_ROW = {
  id: ISSUE_ID,
  identifier: "TST-1",
  title: "Crossflow test issue",
  status: "todo",
  priority: "high",
  company_id: COMPANY_ID,
  assignee_agent_id: AGENT_ID,
  project_id: null,
};

const ACTIVITY_EVENTS = [
  {
    id: "evt-1",
    action: "issue.created",
    details: "Opened TST-1",
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    issue_id: ISSUE_ID,
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "evt-2",
    action: "run_started",
    details: "Autonomous run started",
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    issue_id: ISSUE_ID,
    created_at: "2025-01-01T00:01:00Z",
  },
  {
    id: "evt-3",
    action: "run_completed",
    details: "Autonomous run completed",
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    issue_id: ISSUE_ID,
    created_at: "2025-01-01T00:02:00Z",
  },
];

const RUNS = [
  {
    id: RUN_ID,
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    status: "completed",
    summary: "Fix crossflow test issue",
    issue_id: ISSUE_ID,
    created_at: "2025-01-01T00:01:00Z",
    finished_at: "2025-01-01T00:02:00Z",
  },
];

const EXECUTION_LOGS = [
  {
    id: "log-1",
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    run_id: RUN_ID,
    log_type: "decision",
    content: { action: "loop_start", task: "Fix crossflow test issue", issueId: ISSUE_ID },
    created_at: "2025-01-01T00:01:00Z",
  },
  {
    id: "log-2",
    agent_id: AGENT_ID,
    company_id: COMPANY_ID,
    run_id: RUN_ID,
    log_type: "output",
    content: { action: "loop_end", success: true, issueId: ISSUE_ID },
    created_at: "2025-01-01T00:02:00Z",
  },
];

const APPROVALS = [
  {
    id: "approval-1",
    company_id: COMPANY_ID,
    requested_by_agent_id: AGENT_ID,
    issue_id: ISSUE_ID,
    status: "pending",
    summary: "Approval requested for crossflow test",
    created_at: "2025-01-01T00:01:30Z",
  },
];

/* ---------- Mock builder ---------- */

function setupMock(opts?: {
  issueRow?: typeof ISSUE_ROW | null;
  activityEvents?: typeof ACTIVITY_EVENTS;
  runs?: typeof RUNS;
  executionLogs?: typeof EXECUTION_LOGS;
  approvals?: typeof APPROVALS;
  incoherentActivity?: boolean;
}) {
  const issueData = opts?.issueRow !== undefined ? opts.issueRow : ISSUE_ROW;

  mockFrom.mockImplementation((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockImplementation(() => {
      // For tables that resolve via .order(), return the data array
      if (table === "activity_events") {
        const events = opts?.incoherentActivity
          ? (opts?.activityEvents ?? ACTIVITY_EVENTS).map((e, i) =>
              i === 0 ? { ...e, company_id: "WRONG-COMPANY" } : e,
            )
          : (opts?.activityEvents ?? ACTIVITY_EVENTS);
        return Promise.resolve({ data: events, error: null });
      }
      if (table === "runs") return Promise.resolve({ data: opts?.runs ?? RUNS, error: null });
      if (table === "agent_execution_logs")
        return Promise.resolve({ data: opts?.executionLogs ?? EXECUTION_LOGS, error: null });
      if (table === "approvals")
        return Promise.resolve({ data: opts?.approvals ?? APPROVALS, error: null });
      return Promise.resolve({ data: [], error: null });
    });
    chain.maybeSingle = vi.fn().mockImplementation(() => {
      if (table === "issues") {
        return Promise.resolve({ data: issueData, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
    return chain;
  });
}

/* ---------- Tests ---------- */

describe("VAL-CROSS-003: Issue → Runtime crossflow trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a coherent trace with matching IDs across all artifacts", async () => {
    setupMock();
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);

    expect(trace.issue).not.toBeNull();
    expect(trace.issue?.id).toBe(ISSUE_ID);
    expect(trace.issue?.company_id).toBe(COMPANY_ID);
    expect(trace.issue?.assignee_agent_id).toBe(AGENT_ID);
    expect(trace.activityEvents).toHaveLength(3);
    expect(trace.runs).toHaveLength(1);
    expect(trace.executionLogs).toHaveLength(2);
    expect(trace.approvals).toHaveLength(1);
    expect(trace.coherent).toBe(true);
    expect(trace.violations).toHaveLength(0);
  });

  it("activity events share the same issue_id and company_id as the issue", async () => {
    setupMock();
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);

    for (const evt of trace.activityEvents) {
      expect(evt.issue_id).toBe(ISSUE_ID);
      expect(evt.company_id).toBe(COMPANY_ID);
    }
  });

  it("runs share the same issue_id and company_id as the issue", async () => {
    setupMock();
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);

    for (const run of trace.runs) {
      expect(run.issue_id).toBe(ISSUE_ID);
      expect(run.company_id).toBe(COMPANY_ID);
      expect(run.agent_id).toBe(AGENT_ID);
    }
  });

  it("execution logs share the same company_id and reference linked run IDs", async () => {
    setupMock();
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);
    const runIds = trace.runs.map((r) => r.id);

    for (const log of trace.executionLogs) {
      expect(log.company_id).toBe(COMPANY_ID);
      expect(runIds).toContain(log.run_id);
    }
  });

  it("approvals share the same issue_id and company_id", async () => {
    setupMock();
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);

    for (const approval of trace.approvals) {
      expect(approval.issue_id).toBe(ISSUE_ID);
      expect(approval.company_id).toBe(COMPANY_ID);
    }
  });

  it("detects incoherent company_id in activity events", async () => {
    setupMock({ incoherentActivity: true });
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);

    expect(trace.coherent).toBe(false);
    expect(trace.violations.length).toBeGreaterThan(0);
    expect(trace.violations[0]).toContain("WRONG-COMPANY");
  });

  it("returns incoherent trace when issue is not found", async () => {
    setupMock({ issueRow: null });
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime("nonexistent-issue");

    expect(trace.issue).toBeNull();
    expect(trace.coherent).toBe(false);
    expect(trace.violations[0]).toContain("not found");
  });

  it("handles trace with activity events but no runs (pre-execution state)", async () => {
    setupMock({ runs: [], executionLogs: [], approvals: [] });
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);

    expect(trace.issue).not.toBeNull();
    expect(trace.activityEvents).toHaveLength(3);
    expect(trace.runs).toHaveLength(0);
    expect(trace.executionLogs).toHaveLength(0);
    expect(trace.approvals).toHaveLength(0);
    expect(trace.coherent).toBe(true);
  });

  it("runtime traces stay coherent via shared issue and agent IDs", async () => {
    // This verifies the persisted runtime contract:
    // when execution records exist for an issue, the related run,
    // activity events, execution logs, and optional approval all
    // share the same issueId, companyId, and agentId.
    setupMock();
    const { traceIssueRuntime } = await import("@/lib/crossflows/issue-runtime-trace");

    const trace = await traceIssueRuntime(ISSUE_ID);

    // The trace should demonstrate the full lifecycle:
    // 1. Issue exists with assignee
    expect(trace.issue?.assignee_agent_id).toBe(AGENT_ID);

    // 2. Activity events include issue.created and run lifecycle events
    const actions = trace.activityEvents.map((e) => e.action);
    expect(actions).toContain("issue.created");
    expect(actions).toContain("run_started");
    expect(actions).toContain("run_completed");

    // 3. Run is linked to the issue
    expect(trace.runs[0]?.issue_id).toBe(ISSUE_ID);

    // 4. Execution logs are linked to the run
    expect(trace.executionLogs[0]?.run_id).toBe(trace.runs[0]?.id);

    // 5. All share company_id
    expect(trace.coherent).toBe(true);
  });
});
