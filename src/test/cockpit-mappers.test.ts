import { describe, expect, it } from "vitest";

import { DEMO_SNAPSHOT } from "@/features/cockpit/lib/demoData";
import { buildCockpitRuntime } from "@/features/cockpit/lib/mappers";

describe("buildCockpitRuntime", () => {
  it("maps the demo snapshot into a runtime agent set and project summary", () => {
    const runtime = buildCockpitRuntime(DEMO_SNAPSHOT);

    expect(runtime.agentSet.companyName).toBe("Acme Delegation");
    expect(runtime.agentSet.agents).toHaveLength(3);
    expect(runtime.tasks).toHaveLength(2);
    expect(runtime.phase).toBe("awaiting_approval");
    expect(runtime.projectInspector.stats[0]?.value).toBe("2");
  });

  it("creates an inspector model for the runtime engineer", () => {
    const runtime = buildCockpitRuntime(DEMO_SNAPSHOT);

    const engineerInspector = runtime.agentInspectors[2];
    expect(engineerInspector.agentName).toBe("Founding Engineer");
    expect(engineerInspector.latestRun?.statusLabel).toBe("running");
    expect(engineerInspector.links.some((link) => link.label === "Agent")).toBe(true);
  });
});
