import { describe, expect, it } from "vitest";

describe("redactPrivateReasoning", () => {
  it("replaces private reasoning fields with the redaction placeholder", async () => {
    const {
      PRIVATE_REASONING_REDACTED,
      redactPrivateReasoning,
    } = await import("@/lib/venice/private-reasoning");

    const redacted = redactPrivateReasoning({
      venice_reasoning: "hidden",
      nested: {
        private_reasoning_content: "also hidden",
      },
      visible: "kept",
    });

    expect(redacted).toEqual({
      venice_reasoning: PRIVATE_REASONING_REDACTED,
      nested: {
        private_reasoning_content: PRIVATE_REASONING_REDACTED,
      },
      visible: "kept",
    });
  });
});

describe("executeVeniceStep", () => {
  it("produces Venice-tagged step metadata without using the legacy loop runtime", async () => {
    const { executeVeniceStep } = await import("@/lib/venice/private-reasoning");

    const discover = await executeVeniceStep("discover", {
      task: "Analyze market conditions",
      veniceModel: "venice-large",
      agentName: "Research Agent",
      agentRole: "analyst",
      adapterType: "process",
      previousSteps: [],
    });

    expect(discover).toMatchObject({
      veniceRouted: true,
      veniceModel: "venice-large",
      privateCognitionEnabled: true,
      adapterType: "process",
      taskAnalysis: "Analyze market conditions",
    });
    expect(discover).toHaveProperty("venice_reasoning");
  });
});

describe("redactRunLogExport", () => {
  it("redacts private reasoning in exported run log entries", async () => {
    const {
      PRIVATE_REASONING_REDACTED,
      redactRunLogExport,
    } = await import("@/lib/venice/private-reasoning");

    const exportPayload = redactRunLogExport({
      run_id: "run-1",
      status: "completed",
      summary: "done",
      total_input_tokens: 1,
      total_output_tokens: 2,
      total_cost_usd: 0.03,
      entries: [
        {
          log_id: "log-1",
          timestamp: "2026-03-20T00:00:00.000Z",
          type: "output",
          content: {
            venice_reasoning: "hidden",
            result: "visible",
          },
          agent_id: "agent-1",
          run_id: "run-1",
        },
      ],
    });

    expect(exportPayload.entries[0]?.content).toEqual({
      venice_reasoning: PRIVATE_REASONING_REDACTED,
      result: "visible",
    });
  });
});
