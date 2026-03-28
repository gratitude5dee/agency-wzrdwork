import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequestServerJson = vi.fn();

vi.mock("@/lib/server-api/http", () => ({
  requestServerJson: (...args: unknown[]) => mockRequestServerJson(...args),
}));

describe("enqueueAgentWakeup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invokes the server wakeup route and returns identifiers", async () => {
    mockRequestServerJson.mockResolvedValue({
      wakeupRequestId: "wake-1",
      heartbeatRunId: "heartbeat-1",
      status: "pending",
    });

    const { enqueueAgentWakeup } = await import("@/lib/control-plane/client");
    const result = await enqueueAgentWakeup({
      agentId: "agent-1",
      companyId: "company-1",
      walletAddress: "0xabc",
      reason: "Manual wakeup",
      payload: { task: "Manual wakeup" },
    });

    expect(mockRequestServerJson).toHaveBeenCalledWith("/api/agents/agent-1/wakeup", {
      method: "POST",
      actor: {
        walletAddress: "0xabc",
        companyId: "company-1",
      },
      body: {
        reason: "Manual wakeup",
        payload: { task: "Manual wakeup" },
      },
    });
    expect(result).toEqual({
      wakeupRequestId: "wake-1",
      heartbeatRunId: "heartbeat-1",
      status: "pending",
    });
  });

  it("throws when the server request fails", async () => {
    mockRequestServerJson.mockRejectedValue(new Error("boom"));

    const { enqueueAgentWakeup } = await import("@/lib/control-plane/client");

    await expect(
      enqueueAgentWakeup({ agentId: "agent-1" }),
    ).rejects.toThrow("boom");
  });
});
