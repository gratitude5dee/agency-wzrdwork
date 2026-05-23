import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

/* ---------- thirdweb mock ---------- */

const mockUseActiveAccount = vi.fn();
const mockUseActiveWalletConnectionStatus = vi.fn();

vi.mock("thirdweb/react", () => ({
  ThirdwebProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ConnectButton: (props: Record<string, unknown>) => (
    <button data-testid="connect-button">{String(props.connectButton && (props.connectButton as { label?: string }).label) || "Connect"}</button>
  ),
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWallet: () => ({ id: "wallet-1" }),
  useActiveWalletConnectionStatus: () => mockUseActiveWalletConnectionStatus(),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  getDefaultToken: () => ({
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    name: "USD Coin",
    symbol: "USDC",
  }),
}));

vi.mock("thirdweb", () => ({
  createThirdwebClient: () => ({ clientId: "test" }),
}));

vi.mock("thirdweb/wallets", () => ({
  inAppWallet: () => ({ id: "inApp" }),
  createWallet: (id: string) => ({ id }),
}));

vi.mock("thirdweb/chains", () => ({
  arbitrum: { id: 42161, name: "Arbitrum One" },
  celo: { id: 42220, name: "Celo" },
}));

/* ---------- ThirdwebProvider context mock ---------- */
/* WalletAuthScreen uses useThirdwebClient() which reads from context.
   Without a ThirdwebProvider wrapper, the context returns null and
   WalletAuthScreen renders nothing. We mock the hook to return a
   fake client so the component renders its full UI in tests. */
vi.mock("@/providers/ThirdwebProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/providers/ThirdwebProvider")>();
  return {
    ...actual,
    useThirdwebClient: () => ({ clientId: "test-client-id" }),
  };
});

/* ---------- supabase mock ---------- */

const mockSupabaseFrom = vi.fn();
const mockSupabaseFunctionsInvoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockSupabaseFunctionsInvoke(...args),
    },
  },
}));

/* ---------- imports (after mocks) ---------- */

import { AuthGate } from "@/components/AuthGate";
import { WalletAuthScreen } from "@/components/WalletAuth";
import { ThirdwebProvider } from "@/providers/ThirdwebProvider";

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

beforeEach(() => {
  // Default supabase mock: from() returns chainable select/update stubs
  mockSupabaseFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
      limit: () => Promise.resolve({ data: [{ id: "comp-1" }] }),
    }),
    update: () => ({
      eq: () => Promise.resolve({ data: null, error: null }),
    }),
  });

  // Default functions.invoke: return a valid client ID
  mockSupabaseFunctionsInvoke.mockResolvedValue({
    data: { clientId: "test-client-id" },
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (import.meta.env as Record<string, unknown>).VITE_DEV_SKIP_AUTH;
  delete (import.meta.env as Record<string, unknown>).VITE_DEV_MOCK_WALLET;
});

/* ---- ThirdwebProvider ---- */

describe("ThirdwebProvider", () => {
  it("renders children inside the provider after loading client ID", async () => {
    render(
      <ThirdwebProvider>
        <div data-testid="child">Hello</div>
      </ThirdwebProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("child")).toBeInTheDocument();
    });
  });

  it("shows error when edge function returns no client ID", async () => {
    mockSupabaseFunctionsInvoke.mockResolvedValue({
      data: { clientId: null },
      error: null,
    });

    render(
      <ThirdwebProvider>
        <div data-testid="child">Hello</div>
      </ThirdwebProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Configuration Error")).toBeInTheDocument();
    });
  });
});

/* ---- WalletAuthScreen ---- */

describe("WalletAuthScreen", () => {
  it("renders the sign-in screen with connect button", () => {
    renderWithProviders(<WalletAuthScreen />);
    expect(screen.getByText("Agency")).toBeInTheDocument();
    expect(screen.getByText(/Connect your wallet/)).toBeInTheDocument();
    expect(screen.getByTestId("connect-button")).toBeInTheDocument();
  });

  it("shows 'Sign in' as the connect button label", () => {
    renderWithProviders(<WalletAuthScreen />);
    expect(screen.getByTestId("connect-button")).toHaveTextContent("Sign in");
  });
});

/* ---- AuthGate ---- */

describe("AuthGate", () => {
  beforeEach(() => {
    mockUseActiveAccount.mockReset();
    mockUseActiveWalletConnectionStatus.mockReset();
  });

  it("shows wallet auth surface when no wallet is connected (VAL-AUTH-001)", () => {
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWalletConnectionStatus.mockReturnValue("disconnected");

    renderWithProviders(
      <AuthGate>
        <div data-testid="app-content">Main App</div>
      </AuthGate>,
    );

    // Protected route should show wallet auth surface, not the app content
    expect(screen.getByText("Agency")).toBeInTheDocument();
    expect(screen.getByTestId("connect-button")).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });

  it("shows connecting state while auto-connecting", () => {
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWalletConnectionStatus.mockReturnValue("connecting");

    renderWithProviders(
      <AuthGate>
        <div data-testid="app-content">Main App</div>
      </AuthGate>,
    );

    expect(screen.getByText("Connecting…")).toBeInTheDocument();
    expect(screen.queryByTestId("app-content")).not.toBeInTheDocument();
  });

  it("renders children when wallet is connected", () => {
    mockUseActiveAccount.mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
    });
    mockUseActiveWalletConnectionStatus.mockReturnValue("connected");

    renderWithProviders(
      <AuthGate>
        <div data-testid="app-content">Main App</div>
      </AuthGate>,
    );

    expect(screen.getByTestId("app-content")).toBeInTheDocument();
    expect(screen.queryByText("Agency")).not.toBeInTheDocument();
  });

  it("bypasses auth when VITE_DEV_SKIP_AUTH is set", () => {
    import.meta.env.VITE_DEV_SKIP_AUTH = "true";
    mockUseActiveAccount.mockReturnValue(undefined);
    mockUseActiveWalletConnectionStatus.mockReturnValue("disconnected");

    renderWithProviders(
      <AuthGate>
        <div data-testid="app-content">Main App</div>
      </AuthGate>,
    );

    // Bypass should show app content even without wallet
    expect(screen.getByTestId("app-content")).toBeInTheDocument();
  });
});

/* ---- useWalletAddressSync ---- */

describe("useWalletAddressSync", () => {
  it("syncs wallet address to company when wallet is connected (VAL-AUTH-003)", async () => {
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: updateEq });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "user_onboarding") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { company_id: "comp-real" },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "companies") {
        return {
          update: updateFn,
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "comp-real", name: "Test", slug: "test", wallet_address: null },
                  error: null,
                }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      };
    });

    mockUseActiveAccount.mockReturnValue({
      address: "0xRealWallet1234567890abcdef1234567890abcdef",
    });

    const { useWalletAddressSync } = await import("@/hooks/useWalletAddressSync");

    function TestHarness() {
      useWalletAddressSync();
      return <div data-testid="synced">synced</div>;
    }

    render(<TestHarness />);

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith({
        wallet_address: "0xRealWallet1234567890abcdef1234567890abcdef",
      });
    });

    expect(updateEq).toHaveBeenCalledWith("id", "comp-real");
  });
});

/* ---- useTruncatedAddress ---- */

describe("useTruncatedAddress", () => {
  it("returns truncated address when connected", async () => {
    mockUseActiveAccount.mockReturnValue({
      address: "0xAbCdEf1234567890AbCdEf1234567890AbCdEfAa",
    });

    const { useTruncatedAddress } = await import("@/hooks/useWalletAddressSync");

    function TestComponent() {
      const addr = useTruncatedAddress();
      return <span data-testid="addr">{addr}</span>;
    }

    render(<TestComponent />);
    expect(screen.getByTestId("addr")).toHaveTextContent("0xAbCd…EfAa");
  });

  it("returns null when no wallet connected and no mock wallet", async () => {
    mockUseActiveAccount.mockReturnValue(undefined);
    delete (import.meta.env as Record<string, unknown>).VITE_DEV_MOCK_WALLET;

    const { useTruncatedAddress } = await import("@/hooks/useWalletAddressSync");

    function TestComponent() {
      const addr = useTruncatedAddress();
      return <span data-testid="addr">{addr ?? "none"}</span>;
    }

    render(<TestComponent />);
    expect(screen.getByTestId("addr")).toHaveTextContent("none");
  });

  it("falls back to VITE_DEV_MOCK_WALLET when no real wallet connected", async () => {
    mockUseActiveAccount.mockReturnValue(undefined);
    import.meta.env.VITE_DEV_MOCK_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

    const { useTruncatedAddress } = await import("@/hooks/useWalletAddressSync");

    function TestComponent() {
      const addr = useTruncatedAddress();
      return <span data-testid="addr">{addr ?? "none"}</span>;
    }

    render(<TestComponent />);
    expect(screen.getByTestId("addr")).toHaveTextContent("0x1234…5678");
  });

  it("prefers real wallet over mock wallet", async () => {
    mockUseActiveAccount.mockReturnValue({
      address: "0xAbCdEf1234567890AbCdEf1234567890AbCdEfAa",
    });
    import.meta.env.VITE_DEV_MOCK_WALLET = "0x1234567890abcdef1234567890abcdef12345678";

    const { useTruncatedAddress } = await import("@/hooks/useWalletAddressSync");

    function TestComponent() {
      const addr = useTruncatedAddress();
      return <span data-testid="addr">{addr ?? "none"}</span>;
    }

    render(<TestComponent />);
    expect(screen.getByTestId("addr")).toHaveTextContent("0xAbCd…EfAa");
  });
});
