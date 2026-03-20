import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnqueueAgentWakeup = vi.fn();
const mockGetAgentDetailRecord = vi.fn();
const mockUpdateAgentRecord = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/lib/server-api/agents", () => ({
  getAgentDetailRecord: (...args: unknown[]) => mockGetAgentDetailRecord(...args),
  updateAgentRecord: (...args: unknown[]) => mockUpdateAgentRecord(...args),
}));

vi.mock("@/lib/control-plane/client", () => ({
  enqueueAgentWakeup: (...args: unknown[]) => mockEnqueueAgentWakeup(...args),
}));

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0xabc" }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/components/AgentIdentitySection", () => ({
  AgentIdentitySection: () => <div data-testid="identity-section" />,
}));

vi.mock("@/components/AgentSkillAssignment", () => ({
  AgentSkillAssignment: () => <div data-testid="skill-section" />,
}));

vi.mock("@/components/AgentIntegrationConfig", () => ({
  AgentIntegrationConfig: () => <div data-testid="integration-section" />,
}));

vi.mock("@/hooks/useAgentComposioTools", () => ({
  useAgentComposioTools: () => ({
    composioAvailable: false,
    effectiveTools: [],
    hasAgentOverride: false,
  }),
}));

vi.mock("@/lib/erc8004/download", () => ({
  getRunLogJson: vi.fn(),
  triggerJsonDownload: vi.fn(),
}));

interface AgentFixture {
  company_id: string;
  id: string;
  name: string;
  role: string;
  title: string | null;
  status: string;
  adapter_type: string;
  adapter_config: Record<string, unknown>;
  capabilities: string | null;
  reports_to: string | null;
  seat_index: number;
  private_cognition_enabled: boolean;
  venice_model: string | null;
  created_at: string;
  updated_at: string;
}

let currentAgent: AgentFixture;

describe("AgentDetailPage control-plane run action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentAgent = {
      company_id: "company-1",
      id: "agent-1",
      name: "Agent One",
      role: "engineer",
      title: null,
      status: "idle",
      adapter_type: "process",
      adapter_config: { heartbeatEnabled: false, intervalSec: 30 },
      capabilities: null,
      reports_to: null,
      seat_index: 1,
      private_cognition_enabled: false,
      venice_model: null,
      created_at: "2026-03-20T00:00:00.000Z",
      updated_at: "2026-03-20T00:00:00.000Z",
    };

    mockGetAgentDetailRecord.mockImplementation(async () => ({
      agent: currentAgent,
      runs: [],
      issues: [],
    }));
    mockEnqueueAgentWakeup.mockResolvedValue({
      wakeupRequestId: "wake-1",
      heartbeatRunId: "heartbeat-1",
      status: "pending",
    });
    mockUpdateAgentRecord.mockResolvedValue(undefined);
  });

  it("enqueues work when the adapter is executable", async () => {
    const { AgentDetailPage } = await import("@/pages/AgentDetail");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/agents/${currentAgent.id}`]}>
          <Routes>
            <Route path="/agents/:id" element={<AgentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const button = await screen.findByRole("button", { name: /run agent/i });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockEnqueueAgentWakeup).toHaveBeenCalledWith({
        agentId: "agent-1",
        companyId: "company-1",
        reason: "Manual wakeup for Agent One",
        payload: {
          task: "Manual wakeup for Agent One",
        },
      });
    });
  });

  it("disables the run action for config-only adapters", async () => {
    currentAgent = {
      ...currentAgent,
      adapter_type: "claude_local",
    };

    const { AgentDetailPage } = await import("@/pages/AgentDetail");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/agents/${currentAgent.id}`]}>
          <Routes>
            <Route path="/agents/:id" element={<AgentDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const button = await screen.findByRole("button", { name: /run agent/i });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(mockEnqueueAgentWakeup).not.toHaveBeenCalled();
  });
});
