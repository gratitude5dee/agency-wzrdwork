import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CockpitSceneProofPanel,
  type SceneProofSnapshot,
} from "@/features/cockpit/components/CockpitSceneProofPanel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProofSnapshot(
  overrides: Partial<SceneProofSnapshot> = {},
): SceneProofSnapshot {
  return {
    sceneStatus: "ready",
    dataSource: "supabase",
    companyName: "Acme Corp",
    phase: "working",
    npcNames: ["CEO", "Engineer", "Designer"],
    npcCount: 3,
    lastSyncAt: "2025-01-15T12:00:00.000Z",
    errorMessage: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Proof panel renders with correct data attributes
// ---------------------------------------------------------------------------
describe("CockpitSceneProofPanel", () => {
  it("renders collapsed with scene status visible", () => {
    render(<CockpitSceneProofPanel snapshot={makeProofSnapshot()} />);

    expect(screen.getByText("Scene Proof")).toBeInTheDocument();
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("exposes all data-proof-* attributes on the root element", () => {
    const snapshot = makeProofSnapshot({
      sceneStatus: "ready",
      dataSource: "supabase",
      companyName: "Acme Corp",
      phase: "working",
      npcCount: 3,
      npcNames: ["CEO", "Engineer", "Designer"],
      lastSyncAt: "2025-01-15T12:00:00.000Z",
    });

    render(<CockpitSceneProofPanel snapshot={snapshot} />);

    const root = screen.getByTestId("cockpit-scene-proof-panel");
    expect(root.getAttribute("data-proof-scene-status")).toBe("ready");
    expect(root.getAttribute("data-proof-data-source")).toBe("supabase");
    expect(root.getAttribute("data-proof-company-name")).toBe("Acme Corp");
    expect(root.getAttribute("data-proof-phase")).toBe("working");
    expect(root.getAttribute("data-proof-npc-count")).toBe("3");
    expect(root.getAttribute("data-proof-npc-names")).toBe("CEO,Engineer,Designer");
    expect(root.getAttribute("data-proof-last-sync")).toBe("2025-01-15T12:00:00.000Z");
    expect(root.getAttribute("data-proof-error")).toBe("");
  });

  it("exposes error message in data-proof-error attribute", () => {
    const snapshot = makeProofSnapshot({
      sceneStatus: "error",
      errorMessage: "WebGPU not available",
    });

    render(<CockpitSceneProofPanel snapshot={snapshot} />);

    const root = screen.getByTestId("cockpit-scene-proof-panel");
    expect(root.getAttribute("data-proof-error")).toBe("WebGPU not available");
  });

  it("expands to show detailed proof rows when toggled", () => {
    render(<CockpitSceneProofPanel snapshot={makeProofSnapshot()} />);

    // Should not show detail rows when collapsed
    expect(screen.queryByTestId("proof-source")).not.toBeInTheDocument();

    // Toggle open
    fireEvent.click(screen.getByTestId("cockpit-proof-toggle"));

    // Now detail rows should be visible
    expect(screen.getByTestId("proof-source")).toBeInTheDocument();
    expect(screen.getByTestId("proof-company")).toBeInTheDocument();
    expect(screen.getByTestId("proof-phase")).toBeInTheDocument();
    expect(screen.getByTestId("proof-npc-count")).toBeInTheDocument();
    expect(screen.getByTestId("proof-last-sync")).toBeInTheDocument();
  });

  it("lists individual NPC names when expanded", () => {
    render(
      <CockpitSceneProofPanel
        snapshot={makeProofSnapshot({
          npcNames: ["CEO", "CTO", "Engineer"],
          npcCount: 3,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("cockpit-proof-toggle"));

    const list = screen.getByTestId("proof-npc-list");
    expect(list).toBeInTheDocument();

    const items = list.querySelectorAll("[data-proof-agent-name]");
    expect(items.length).toBe(3);
    expect(items[0]?.getAttribute("data-proof-agent-name")).toBe("CEO");
    expect(items[1]?.getAttribute("data-proof-agent-name")).toBe("CTO");
    expect(items[2]?.getAttribute("data-proof-agent-name")).toBe("Engineer");
  });

  it("hides NPC name list when npcNames is empty", () => {
    render(
      <CockpitSceneProofPanel
        snapshot={makeProofSnapshot({ npcNames: [], npcCount: 0 })}
      />,
    );

    fireEvent.click(screen.getByTestId("cockpit-proof-toggle"));

    expect(screen.queryByTestId("proof-npc-list")).not.toBeInTheDocument();
  });

  it("shows the error row when expanded and error exists", () => {
    render(
      <CockpitSceneProofPanel
        snapshot={makeProofSnapshot({
          sceneStatus: "error",
          errorMessage: "GPU crashed",
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("cockpit-proof-toggle"));

    expect(screen.getByTestId("proof-error")).toBeInTheDocument();
    expect(screen.getByText("GPU crashed")).toBeInTheDocument();
  });

  it("does not show error row when no error", () => {
    render(
      <CockpitSceneProofPanel
        snapshot={makeProofSnapshot({ errorMessage: null })}
      />,
    );

    fireEvent.click(screen.getByTestId("cockpit-proof-toggle"));

    expect(screen.queryByTestId("proof-error")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. Scene status color variants
// ---------------------------------------------------------------------------
describe("CockpitSceneProofPanel status display", () => {
  it.each<[SceneProofSnapshot["sceneStatus"], string]>([
    ["ready", "ready"],
    ["loading", "loading"],
    ["unsupported", "unsupported"],
    ["error", "error"],
  ])("displays %s status text in the collapsed header", (status, expectedText) => {
    render(
      <CockpitSceneProofPanel snapshot={makeProofSnapshot({ sceneStatus: status })} />,
    );

    const root = screen.getByTestId("cockpit-scene-proof-panel");
    expect(root.getAttribute("data-proof-scene-status")).toBe(status);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3. Backend-to-scene propagation: NPC count changes
// ---------------------------------------------------------------------------
describe("Proof panel reflects NPC population changes", () => {
  it("updates npc-count when agents are added", () => {
    const { rerender } = render(
      <CockpitSceneProofPanel
        snapshot={makeProofSnapshot({ npcCount: 2, npcNames: ["CEO", "CTO"] })}
      />,
    );

    const root = screen.getByTestId("cockpit-scene-proof-panel");
    expect(root.getAttribute("data-proof-npc-count")).toBe("2");

    // Rerender with an additional agent
    rerender(
      <CockpitSceneProofPanel
        snapshot={makeProofSnapshot({
          npcCount: 3,
          npcNames: ["CEO", "CTO", "New Hire"],
        })}
      />,
    );

    expect(root.getAttribute("data-proof-npc-count")).toBe("3");
    expect(root.getAttribute("data-proof-npc-names")).toBe("CEO,CTO,New Hire");
  });

  it("updates phase when project state changes", () => {
    const { rerender } = render(
      <CockpitSceneProofPanel snapshot={makeProofSnapshot({ phase: "idle" })} />,
    );

    const root = screen.getByTestId("cockpit-scene-proof-panel");
    expect(root.getAttribute("data-proof-phase")).toBe("idle");

    rerender(
      <CockpitSceneProofPanel snapshot={makeProofSnapshot({ phase: "working" })} />,
    );

    expect(root.getAttribute("data-proof-phase")).toBe("working");
  });

  it("reflects data source change from demo to supabase", () => {
    const { rerender } = render(
      <CockpitSceneProofPanel snapshot={makeProofSnapshot({ dataSource: "demo" })} />,
    );

    const root = screen.getByTestId("cockpit-scene-proof-panel");
    expect(root.getAttribute("data-proof-data-source")).toBe("demo");

    rerender(
      <CockpitSceneProofPanel snapshot={makeProofSnapshot({ dataSource: "supabase" })} />,
    );

    expect(root.getAttribute("data-proof-data-source")).toBe("supabase");
  });

  it("updates last-sync timestamp", () => {
    const ts1 = "2025-01-15T12:00:00.000Z";
    const ts2 = "2025-01-15T12:00:10.000Z";

    const { rerender } = render(
      <CockpitSceneProofPanel snapshot={makeProofSnapshot({ lastSyncAt: ts1 })} />,
    );

    const root = screen.getByTestId("cockpit-scene-proof-panel");
    expect(root.getAttribute("data-proof-last-sync")).toBe(ts1);

    rerender(
      <CockpitSceneProofPanel snapshot={makeProofSnapshot({ lastSyncAt: ts2 })} />,
    );

    expect(root.getAttribute("data-proof-last-sync")).toBe(ts2);
  });
});
