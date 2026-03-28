import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseActiveAccount = vi.fn();
const mockUseActiveWalletConnectionStatus = vi.fn();
const mockGetAccessMe = vi.fn();
const mockRequestAuthChallenge = vi.fn();
const mockVerifyAuthChallenge = vi.fn();

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWalletConnectionStatus: () => mockUseActiveWalletConnectionStatus(),
}));

vi.mock("@/lib/server-api/auth", () => ({
  getAccessMe: (...args: unknown[]) => mockGetAccessMe(...args),
  requestAuthChallenge: (...args: unknown[]) => mockRequestAuthChallenge(...args),
  verifyAuthChallenge: (...args: unknown[]) => mockVerifyAuthChallenge(...args),
}));

vi.mock("@/components/WalletAuth", () => ({
  WalletAuthScreen: () => <div>Wallet Auth</div>,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

describe("AuthGate server session flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.VITE_SERVER_URL = "http://127.0.0.1:4321";
  });

  afterEach(() => {
    delete (import.meta.env as Record<string, unknown>).VITE_SERVER_URL;
    window.localStorage.clear();
  });

  it("renders the app when an existing server session is valid", async () => {
    mockUseActiveWalletConnectionStatus.mockReturnValue("connected");
    mockUseActiveAccount.mockReturnValue({
      address: "0xabc",
      signMessage: vi.fn(),
    });
    mockGetAccessMe.mockResolvedValue({
      actor: {},
      activeCompany: null,
      accessibleCompanies: [],
      memberships: [],
      instanceRoles: [],
    });

    const { AuthGate } = await import("@/components/AuthGate");

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <AuthGate>
            <div>App Ready</div>
          </AuthGate>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("App Ready")).toBeInTheDocument();
    });
    expect(mockRequestAuthChallenge).not.toHaveBeenCalled();
    expect(mockVerifyAuthChallenge).not.toHaveBeenCalled();
  });

  it("creates a signed session when the server has no current session", async () => {
    const signMessage = vi.fn().mockResolvedValue("0xsigned");

    mockUseActiveWalletConnectionStatus.mockReturnValue("connected");
    mockUseActiveAccount.mockReturnValue({
      address: "0xabc",
      signMessage,
    });
    mockGetAccessMe.mockRejectedValueOnce(new Error("unauthorized"));
    mockRequestAuthChallenge.mockResolvedValue({
      message: "Sign this",
      nonce: "nonce-1",
      expiresAt: "2026-03-20T00:10:00.000Z",
    });
    mockVerifyAuthChallenge.mockResolvedValue({
      sessionToken: "session-1",
      actor: {},
      activeCompany: null,
      accessibleCompanies: [],
    });

    const { AuthGate } = await import("@/components/AuthGate");

    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <AuthGate>
            <div>App Ready</div>
          </AuthGate>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("App Ready")).toBeInTheDocument();
    });

    expect(mockRequestAuthChallenge).toHaveBeenCalledWith("0xabc");
    expect(signMessage).toHaveBeenCalledWith({ message: "Sign this" });
    expect(mockVerifyAuthChallenge).toHaveBeenCalledWith({
      walletAddress: "0xabc",
      nonce: "nonce-1",
      message: "Sign this",
      signature: "0xsigned",
    });
  });
});
