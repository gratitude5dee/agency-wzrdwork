/**
 * Delegation Surface — Tests
 *
 * Tests the DelegationsPage component: rendering, creating delegation chains,
 * inspecting them, revoking them, and exercising invalid/expired action rejection paths.
 *
 * The page now loads persisted chains from Supabase on mount and saves back after
 * create/revoke. Tests mock the Supabase layer to return empty chains initially.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

// ---- Supabase mock ----
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// ---- Active company mock ----
vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "test-co", name: "Test Co", slug: "test-co", wallet_address: "0xCEO_wallet" },
    companyId: "test-co",
    isLoading: false,
    error: null,
  }),
}));

// Clear delegation state between tests
beforeEach(async () => {
  const { clearDelegations } = await import("@/lib/delegations");
  clearDelegations();
});

// ---- Helpers ----

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

/**
 * Sets up the Supabase mock to handle both load (maybeSingle with config) and
 * save (select for existing row, then insert/update) operations.
 */
function setupSupabaseMock(overrides?: {
  loadResult?: { data: unknown; error: unknown };
}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnValue({ error: null, data: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ error: null, data: null }),
    }),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue(
      overrides?.loadResult ?? { data: null, error: null },
    ),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    limit: vi.fn().mockReturnThis(),
  };
  mockFrom.mockReturnValue(chain);
  return chain;
}

/** Helper to wait for the loading state to resolve. */
async function waitForLoaded() {
  await waitFor(() => {
    // Either "No delegation chains" or chain cards should appear
    const loaded = screen.queryByText(/no delegation chains/i) ||
      screen.queryByText(/delegations/i);
    expect(loaded).toBeTruthy();
  });
}

/** Helper to create a chain in the UI. */
async function createChainInUI() {
  fireEvent.click(screen.getByRole("button", { name: /create chain/i }));

  await waitFor(() => {
    expect(screen.getByText(/create delegation chain/i)).toBeInTheDocument();
  });

  fireEvent.change(screen.getByLabelText(/ceo wallet/i), {
    target: { value: "0xAliceWallet" },
  });
  fireEvent.change(screen.getByLabelText(/department agent/i), {
    target: { value: "0xDeptBob" },
  });
  fireEvent.change(screen.getByLabelText(/task agent/i), {
    target: { value: "0xTaskCharlie" },
  });

  fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

  // Wait for chain card to appear — look for the addresses that identify the chain
  await waitFor(() => {
    expect(screen.getByText("0xAliceWallet")).toBeInTheDocument();
  });
}

// ---- Tests ----

describe("DelegationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders page heading and description", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    expect(screen.getByText("Delegations")).toBeInTheDocument();
    expect(
      screen.getByText(/manage scoped delegation chains/i),
    ).toBeInTheDocument();
  });

  it("renders a 'Create Chain' button", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    expect(
      screen.getByRole("button", { name: /create chain/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state when no delegation chains exist", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    expect(screen.getByText(/no delegation chains/i)).toBeInTheDocument();
  });

  it("shows loading state initially", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    // Return a promise that never resolves to keep loading state
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
    };
    mockFrom.mockReturnValue(chain);

    renderWithProviders(<DelegationsPage />);

    expect(screen.getByText(/loading delegation chains/i)).toBeInTheDocument();
  });

  it("opens create dialog when 'Create Chain' is clicked", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    fireEvent.click(screen.getByRole("button", { name: /create chain/i }));

    await waitFor(() => {
      expect(screen.getByText(/create delegation chain/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/ceo wallet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/department agent/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/task agent/i)).toBeInTheDocument();
  });

  it("creates a delegation chain and displays it", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    // Chain nodes should show the role labels and addresses (all <=14 chars, shown as-is)
    expect(screen.getByText("0xAliceWallet")).toBeInTheDocument();
    expect(screen.getByText("0xDeptBob")).toBeInTheDocument();
    expect(screen.getByText("0xTaskCharlie")).toBeInTheDocument();
  });

  it("inspects a delegation chain and shows scope data", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    const inspectButton = screen.getByRole("button", { name: /inspect/i });
    fireEvent.click(inspectButton);

    // Inspection panel should show scope data (multiple nodes have these labels)
    await waitFor(() => {
      expect(screen.getAllByText(/spend limit/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/time window/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/task permissions/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("revokes a delegation chain and shows revoked status", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    const revokeButton = screen.getByRole("button", { name: /revoke/i });
    fireEvent.click(revokeButton);

    // Status badge should show "revoked"
    await waitFor(() => {
      expect(screen.getByText("revoked")).toBeInTheDocument();
    });
  });

  it("validates an action and shows rejection for overscoped action type", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    // Click inspect
    fireEvent.click(screen.getByRole("button", { name: /inspect/i }));

    // Wait for inspection panel with the "Test Action" button
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test action/i })).toBeInTheDocument();
    });

    // Fill action type with unsupported action
    fireEvent.change(screen.getByLabelText(/action type/i), {
      target: { value: "liquidate" },
    });

    fireEvent.click(screen.getByRole("button", { name: /test action/i }));

    await waitFor(() => {
      expect(screen.getByText(/not in the allowed task permissions/i)).toBeInTheDocument();
    });
  });

  it("validates an action and shows rejection for over-budget amount", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    fireEvent.click(screen.getByRole("button", { name: /inspect/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test action/i })).toBeInTheDocument();
    });

    // Valid type but excessive amount
    fireEvent.change(screen.getByLabelText(/action type/i), {
      target: { value: "swap" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "999999" },
    });

    fireEvent.click(screen.getByRole("button", { name: /test action/i }));

    await waitFor(() => {
      expect(screen.getByText(/exceeds spend limit/i)).toBeInTheDocument();
    });
  });

  it("shows rejection for expired delegation", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    fireEvent.click(screen.getByRole("button", { name: /inspect/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test action/i })).toBeInTheDocument();
    });

    // Valid type but post-window timestamp
    fireEvent.change(screen.getByLabelText(/action type/i), {
      target: { value: "swap" },
    });
    fireEvent.change(screen.getByLabelText(/timestamp/i), {
      target: { value: "2099-01-01T00:00:00Z" },
    });

    fireEvent.click(screen.getByRole("button", { name: /test action/i }));

    await waitFor(() => {
      expect(screen.getByText(/after delegation window end/i)).toBeInTheDocument();
    });
  });

  it("shows rejection for revoked delegation action", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    // Revoke first
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await waitFor(() => {
      expect(screen.getByText("revoked")).toBeInTheDocument();
    });

    // Inspect
    fireEvent.click(screen.getByRole("button", { name: /inspect/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test action/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/action type/i), {
      target: { value: "swap" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test action/i }));

    await waitFor(() => {
      expect(screen.getByText(/Delegation is revoked/i)).toBeInTheDocument();
    });
  });

  it("displays multiple chains when created", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    // Create first chain
    fireEvent.click(screen.getByRole("button", { name: /create chain/i }));
    await waitFor(() => {
      expect(screen.getByText(/create delegation chain/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/ceo wallet/i), {
      target: { value: "0xAlpha" },
    });
    fireEvent.change(screen.getByLabelText(/department agent/i), {
      target: { value: "0xBeta" },
    });
    fireEvent.change(screen.getByLabelText(/task agent/i), {
      target: { value: "0xGamma" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByText("0xAlpha")).toBeInTheDocument();
    });

    // Create second chain
    fireEvent.click(screen.getByRole("button", { name: /create chain/i }));
    await waitFor(() => {
      expect(screen.getByText(/create delegation chain/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/ceo wallet/i), {
      target: { value: "0xDelta" },
    });
    fireEvent.change(screen.getByLabelText(/department agent/i), {
      target: { value: "0xEpsilon" },
    });
    fireEvent.change(screen.getByLabelText(/task agent/i), {
      target: { value: "0xZeta" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));

    await waitFor(() => {
      expect(screen.getByText("0xDelta")).toBeInTheDocument();
    });

    // Both chains should be visible
    expect(screen.getByText("0xAlpha")).toBeInTheDocument();
    expect(screen.getByText("0xDelta")).toBeInTheDocument();
  });

  it("allows a valid action within delegation constraints", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");
    setupSupabaseMock();

    renderWithProviders(<DelegationsPage />);
    await waitForLoaded();

    await createChainInUI();

    fireEvent.click(screen.getByRole("button", { name: /inspect/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test action/i })).toBeInTheDocument();
    });

    // Valid action within constraints
    fireEvent.change(screen.getByLabelText(/action type/i), {
      target: { value: "swap" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "100" },
    });

    fireEvent.click(screen.getByRole("button", { name: /test action/i }));

    await waitFor(() => {
      expect(screen.getByText(/action allowed/i)).toBeInTheDocument();
    });
  });

  it("loads persisted chains from Supabase on mount", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");

    // Mock Supabase to return a persisted chain
    const persistedChains = [
      {
        id: "chain_persisted_001",
        createdAt: "2025-06-01T00:00:00Z",
        nodes: [
          { address: "0xSavedCEO", role: "CEO", delegation: null },
          {
            address: "0xSavedDept",
            role: "department",
            delegation: {
              id: "deleg_persisted_001",
              from: "0xSavedCEO",
              to: "0xSavedDept",
              permissions: {
                spendLimit: { amount: 10000, currency: "USDC", period: "daily" },
                recipientWhitelist: [],
                timeWindow: {
                  start: "2025-01-01T00:00:00Z",
                  end: "2026-12-31T23:59:59Z",
                },
                taskPermissions: ["swap", "transfer", "stake", "bridge"],
              },
              status: "active",
              createdAt: "2025-06-01T00:00:00Z",
              updatedAt: "2025-06-01T00:00:00Z",
            },
          },
          {
            address: "0xSavedTask",
            role: "task_agent",
            delegation: {
              id: "deleg_persisted_002",
              from: "0xSavedDept",
              to: "0xSavedTask",
              permissions: {
                spendLimit: { amount: 2000, currency: "USDC", period: "daily" },
                recipientWhitelist: [],
                timeWindow: {
                  start: "2025-01-01T00:00:00Z",
                  end: "2026-12-31T23:59:59Z",
                },
                taskPermissions: ["swap", "transfer"],
              },
              status: "active",
              createdAt: "2025-06-01T00:00:00Z",
              updatedAt: "2025-06-01T00:00:00Z",
              parentDelegationId: "deleg_persisted_001",
            },
          },
        ],
      },
    ];

    setupSupabaseMock({
      loadResult: { data: { config: { chains: persistedChains } }, error: null },
    });

    renderWithProviders(<DelegationsPage />);

    // After loading, the persisted chain should be visible
    await waitFor(() => {
      expect(screen.getByText("0xSavedCEO")).toBeInTheDocument();
    });

    expect(screen.getByText("0xSavedDept")).toBeInTheDocument();
    expect(screen.getByText("0xSavedTask")).toBeInTheDocument();
  });

  it("can inspect and test actions on a reloaded persisted chain", async () => {
    const { DelegationsPage } = await import("@/pages/Delegations");

    const persistedChains = [
      {
        id: "chain_reload_test",
        createdAt: "2025-06-01T00:00:00Z",
        nodes: [
          { address: "0xCEOReload", role: "CEO", delegation: null },
          {
            address: "0xDeptReload",
            role: "department",
            delegation: {
              id: "deleg_reload_001",
              from: "0xCEOReload",
              to: "0xDeptReload",
              permissions: {
                spendLimit: { amount: 10000, currency: "USDC", period: "daily" },
                recipientWhitelist: [],
                timeWindow: {
                  start: "2025-01-01T00:00:00Z",
                  end: "2026-12-31T23:59:59Z",
                },
                taskPermissions: ["swap", "transfer", "stake", "bridge"],
              },
              status: "active",
              createdAt: "2025-06-01T00:00:00Z",
              updatedAt: "2025-06-01T00:00:00Z",
            },
          },
          {
            address: "0xTaskReload",
            role: "task_agent",
            delegation: {
              id: "deleg_reload_002",
              from: "0xDeptReload",
              to: "0xTaskReload",
              permissions: {
                spendLimit: { amount: 2000, currency: "USDC", period: "daily" },
                recipientWhitelist: [],
                timeWindow: {
                  start: "2025-01-01T00:00:00Z",
                  end: "2026-12-31T23:59:59Z",
                },
                taskPermissions: ["swap", "transfer"],
              },
              status: "active",
              createdAt: "2025-06-01T00:00:00Z",
              updatedAt: "2025-06-01T00:00:00Z",
              parentDelegationId: "deleg_reload_001",
            },
          },
        ],
      },
    ];

    setupSupabaseMock({
      loadResult: { data: { config: { chains: persistedChains } }, error: null },
    });

    renderWithProviders(<DelegationsPage />);

    await waitFor(() => {
      expect(screen.getByText("0xCEOReload")).toBeInTheDocument();
    });

    // Inspect the chain
    fireEvent.click(screen.getByRole("button", { name: /inspect/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /test action/i })).toBeInTheDocument();
    });

    // Test a valid action — should work because rehydration registered the delegation
    fireEvent.change(screen.getByLabelText(/action type/i), {
      target: { value: "swap" },
    });
    fireEvent.change(screen.getByLabelText(/amount/i), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test action/i }));

    await waitFor(() => {
      expect(screen.getByText(/action allowed/i)).toBeInTheDocument();
    });

    // Test an overscoped action on the reloaded chain
    fireEvent.change(screen.getByLabelText(/action type/i), {
      target: { value: "liquidate" },
    });
    fireEvent.click(screen.getByRole("button", { name: /test action/i }));

    await waitFor(() => {
      expect(screen.getByText(/not in the allowed task permissions/i)).toBeInTheDocument();
    });
  });
});
