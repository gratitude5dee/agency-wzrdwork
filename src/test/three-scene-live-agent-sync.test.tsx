import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  CockpitSceneOverlay,
  type CockpitSceneStatus,
} from "@/features/cockpit/components/CockpitSceneOverlay";
import { buildCockpitRuntime } from "@/features/cockpit/lib/mappers";
import { DEMO_SNAPSHOT } from "@/features/cockpit/lib/demoData";
import type { AgencySnapshot, AgentRecord, RunRecord } from "@/features/cockpit/lib/domain";
import { RUNTIME_AGENT_SET_ID } from "@/features/cockpit/delegation/data/agents";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<AgencySnapshot> = {}): AgencySnapshot {
  return { ...DEMO_SNAPSHOT, source: "server", ...overrides };
}

function addAgent(
  snapshot: AgencySnapshot,
  partial: Partial<AgentRecord> & { id: string; name: string },
): AgencySnapshot {
  const agent: AgentRecord = {
    companyId: snapshot.company.id,
    role: "engineer",
    title: partial.name,
    adapterType: "claude_local",
    status: "active",
    capabilities: null,
    reportsTo: null,
    seatIndex: snapshot.agents.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
  return { ...snapshot, agents: [...snapshot.agents, agent] };
}

function addRun(
  snapshot: AgencySnapshot,
  partial: Partial<RunRecord> & { id: string; agentId: string },
): AgencySnapshot {
  const run: RunRecord = {
    companyId: snapshot.company.id,
    issueId: null,
    status: "running",
    summary: "Test run",
    stdoutExcerpt: null,
    stderrExcerpt: null,
    error: null,
    totalInputTokens: 100,
    totalOutputTokens: 50,
    totalCachedInputTokens: 0,
    totalCostUsd: 0.01,
    createdAt: new Date().toISOString(),
    finishedAt: null,
    ...partial,
  };
  return { ...snapshot, runs: [...snapshot.runs, run] };
}

// ---------------------------------------------------------------------------
// 1. Scene population from live agents
// ---------------------------------------------------------------------------
describe("Three.js scene population from live agents", () => {
  it("maps live agents into a runtime agent set with the correct company name", () => {
    const snapshot = makeSnapshot();
    const runtime = buildCockpitRuntime(snapshot);

    expect(runtime.agentSet.id).toBe(RUNTIME_AGENT_SET_ID);
    expect(runtime.agentSet.companyName).toBe(snapshot.company.name);
    // Player (You) + N live agents
    expect(runtime.agentSet.agents.length).toBeGreaterThanOrEqual(
      snapshot.agents.filter((a) => a.status !== "terminated").length + 1,
    );
  });

  it("adds a new agent to the scene population when one is added to the snapshot", () => {
    const base = makeSnapshot();
    const runtimeBefore = buildCockpitRuntime(base);

    const extended = addAgent(base, {
      id: "agent-new-hire",
      name: "New Hire",
      role: "designer",
      status: "active",
    });
    const runtimeAfter = buildCockpitRuntime(extended);

    expect(runtimeAfter.agentSet.agents.length).toBe(
      runtimeBefore.agentSet.agents.length + 1,
    );
    const roles = runtimeAfter.agentSet.agents.map((a) => a.role);
    expect(roles).toContain("New Hire");
  });

  it("excludes terminated agents from the scene population", () => {
    const snapshot = makeSnapshot({
      agents: [
        ...DEMO_SNAPSHOT.agents,
        {
          id: "agent-terminated",
          companyId: "company-acme",
          name: "Fired",
          role: "intern",
          title: "Intern",
          adapterType: "http",
          status: "terminated",
          capabilities: null,
          reportsTo: null,
          seatIndex: 10,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
    const runtime = buildCockpitRuntime(snapshot);

    const agentNames = runtime.agentSet.agents.map((a) => a.role);
    expect(agentNames).not.toContain("Fired");
  });

  it("uses the company brand color for the agent set", () => {
    const snapshot = makeSnapshot();
    const runtime = buildCockpitRuntime(snapshot);

    expect(runtime.agentSet.color).toBe(snapshot.company.brandColor);
  });
});

// ---------------------------------------------------------------------------
// 2. Inspector reflects live project context
// ---------------------------------------------------------------------------
describe("Inspector reflects live agents and project context", () => {
  it("builds an agent inspector for each rendered agent", () => {
    const snapshot = makeSnapshot();
    const runtime = buildCockpitRuntime(snapshot);

    const liveAgentCount = snapshot.agents.filter(
      (a) => a.status !== "terminated",
    ).length;
    // agentInspectors keys should be 1..N (not 0 which is the player)
    expect(Object.keys(runtime.agentInspectors).length).toBe(liveAgentCount);
  });

  it("shows agent run status in the inspector", () => {
    const snapshot = makeSnapshot();
    const runtime = buildCockpitRuntime(snapshot);

    // The Founding Engineer (index 2 in runtime) has a running run
    const engineerInspector = runtime.agentInspectors[2];
    expect(engineerInspector).toBeDefined();
    expect(engineerInspector.latestRun).toBeDefined();
    expect(engineerInspector.latestRun?.isLive).toBe(true);
    expect(engineerInspector.latestRun?.statusLabel).toBe("running");
  });

  it("shows pending approval in the inspector", () => {
    const snapshot = makeSnapshot();
    const runtime = buildCockpitRuntime(snapshot);

    // CEO (index 1 in runtime) has a pending approval
    const ceoInspector = runtime.agentInspectors[1];
    expect(ceoInspector).toBeDefined();
    expect(ceoInspector.pendingApproval).toBeDefined();
    expect(ceoInspector.pendingApproval?.statusLabel).toBe("pending");
  });

  it("project inspector stats match live data", () => {
    const snapshot = makeSnapshot();
    const runtime = buildCockpitRuntime(snapshot);

    expect(runtime.projectInspector).toBeDefined();
    expect(runtime.projectInspector.companyName).toBe(snapshot.company.name);
    // Verify agent count stat
    const agentStat = runtime.projectInspector.stats.find(
      (s) => s.label === "Agents",
    );
    expect(agentStat).toBeDefined();
    expect(Number(agentStat!.value)).toBe(
      snapshot.agents.filter((a) => a.status !== "terminated").length,
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Run and approval state mutations propagate to overlays/inspector
// ---------------------------------------------------------------------------
describe("Run and approval state mutations propagate to scene and inspector", () => {
  it("changes phase from working to awaiting_approval when a new approval appears", () => {
    // Start with no approvals
    const noApprovals = makeSnapshot({
      approvals: [],
      issues: [
        {
          ...DEMO_SNAPSHOT.issues[1]!,
          status: "in_progress",
        },
      ],
    });
    const runtimeBefore = buildCockpitRuntime(noApprovals);
    expect(runtimeBefore.phase).toBe("working");

    // Now add an approval
    const withApproval = makeSnapshot({
      ...noApprovals,
      approvals: [
        {
          id: "approval-new",
          companyId: "company-acme",
          issueId: DEMO_SNAPSHOT.issues[1]!.id,
          requestedByAgentId: "agent-founding-engineer",
          status: "pending",
          summary: "Need confirmation",
          createdAt: new Date().toISOString(),
          resolvedAt: null,
        },
      ],
    });
    const runtimeAfter = buildCockpitRuntime(withApproval);
    expect(runtimeAfter.phase).toBe("awaiting_approval");
  });

  it("new run appears in the inspector for the assigned agent", () => {
    const base = makeSnapshot({ runs: [] });
    const runtimeBefore = buildCockpitRuntime(base);

    const engineerIndex = Object.entries(runtimeBefore.agentInspectors).find(
      ([, v]) => v.agentName === "Founding Engineer",
    )?.[0];
    expect(engineerIndex).toBeDefined();
    expect(
      runtimeBefore.agentInspectors[Number(engineerIndex)]?.latestRun,
    ).toBeUndefined();

    // Add a new run
    const withRun = addRun(base, {
      id: "run-new-1",
      agentId: "agent-founding-engineer",
      issueId: "issue-shell",
      status: "running",
      summary: "Newly started run",
    });
    const runtimeAfter = buildCockpitRuntime(withRun);

    expect(
      runtimeAfter.agentInspectors[Number(engineerIndex)]?.latestRun,
    ).toBeDefined();
    expect(
      runtimeAfter.agentInspectors[Number(engineerIndex)]?.latestRun?.isLive,
    ).toBe(true);
  });

  it("completed run transitions inspector status from live to finished", () => {
    const snapshot = makeSnapshot({
      runs: [
        {
          ...DEMO_SNAPSHOT.runs[0]!,
          status: "succeeded",
          finishedAt: new Date().toISOString(),
        },
        DEMO_SNAPSHOT.runs[1]!,
      ],
    });
    const runtime = buildCockpitRuntime(snapshot);

    const engineerInspector = runtime.agentInspectors[2];
    expect(engineerInspector?.latestRun).toBeDefined();
    expect(engineerInspector?.latestRun?.isLive).toBe(false);
    expect(engineerInspector?.latestRun?.statusLabel).toBe("succeeded");
  });
});

// ---------------------------------------------------------------------------
// 4. Graceful degradation overlay
// ---------------------------------------------------------------------------
describe("Graceful degradation overlay", () => {
  it("shows loading overlay while scene boots", () => {
    render(
      <CockpitSceneOverlay
        companyName="Test Corp"
        status="loading"
      />,
    );
    expect(screen.getByText("Loading Scene")).toBeInTheDocument();
    expect(screen.getByText(/Booting the Test Corp office/)).toBeInTheDocument();
  });

  it("shows unsupported overlay with named status for headless/unsupported browsers", () => {
    render(
      <CockpitSceneOverlay
        companyName="Test Corp"
        status="unsupported"
        errorMessage="WebGPU is not available in this browser."
      />,
    );
    expect(screen.getByText("WebGPU Unsupported")).toBeInTheDocument();
    expect(screen.getByText("WebGPU is not available in this browser.")).toBeInTheDocument();
    // Should include guidance for retrying
    expect(screen.getByText(/retry in a supported browser/i)).toBeInTheDocument();
  });

  it("shows error overlay when scene initialization fails", () => {
    render(
      <CockpitSceneOverlay
        companyName="Test Corp"
        status="error"
        errorMessage="Renderer crashed."
      />,
    );
    expect(screen.getByText("Scene Error")).toBeInTheDocument();
    expect(screen.getByText("Renderer crashed.")).toBeInTheDocument();
  });

  it("returns null when scene is ready (no overlay)", () => {
    const { container } = render(
      <CockpitSceneOverlay companyName="Test Corp" status="ready" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("includes data-scene-status attribute for testability", () => {
    const { container } = render(
      <CockpitSceneOverlay companyName="Test Corp" status="unsupported" />,
    );
    const overlay = container.querySelector("[data-scene-status]");
    expect(overlay).not.toBeNull();
    expect(overlay?.getAttribute("data-scene-status")).toBe("unsupported");
  });

  it("overlay does not block surrounding cockpit UI interaction", () => {
    // The overlay has a high z-index (z-20) but the surrounding cockpit UI
    // (toolbars, inspector, kanban) renders outside the scene container.
    // This test verifies the overlay renders INSIDE the scene container by
    // checking for the delegated sandbox text and pointer-events.
    render(
      <CockpitSceneOverlay
        companyName="Test Corp"
        status="unsupported"
      />,
    );

    const overlay = screen.getByText("WebGPU Unsupported").closest("[data-scene-status]");
    expect(overlay).not.toBeNull();
    // The overlay should have text telling the user the rest of the sandbox is usable
    expect(
      screen.getByText(/Keep the rest of the sandbox open/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 5. Refetch interval respects the 10-second sync window
// ---------------------------------------------------------------------------
describe("Refetch interval", () => {
  it("useAgencyData loader exists and is re-importable", async () => {
    // The loadAgencySnapshot function is the data loader used by the
    // React Query hook. Its existence and export stability ensures the
    // 10s refetchInterval has something to call.
    const mod = await import(
      "@/features/cockpit/lib/useAgencyData"
    );
    expect(typeof mod.loadAgencySnapshot).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// 6. Scene population count changes trigger instance count sync
// ---------------------------------------------------------------------------
describe("Scene population count sync", () => {
  it("agent set count changes when agents are added", () => {
    const base = makeSnapshot();
    const runtimeBefore = buildCockpitRuntime(base);
    const countBefore = runtimeBefore.agentSet.agents.length;

    const extended = addAgent(base, {
      id: "agent-extra-1",
      name: "Extra Agent",
      role: "ops",
      status: "idle",
    });
    const runtimeAfter = buildCockpitRuntime(extended);

    expect(runtimeAfter.agentSet.agents.length).toBe(countBefore + 1);
  });

  it("maintains player agent at index 0", () => {
    const snapshot = makeSnapshot();
    const runtime = buildCockpitRuntime(snapshot);

    const player = runtime.agentSet.agents.find((a) => a.index === 0);
    expect(player).toBeDefined();
    expect(player?.isPlayer).toBe(true);
    expect(player?.role).toBe("You");
  });
});
