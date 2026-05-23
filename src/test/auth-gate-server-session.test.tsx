import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseActiveAccount = vi.fn();
const mockUseActiveWallet = vi.fn();
const mockUseActiveWalletConnectionStatus = vi.fn();
const mockDisconnect = vi.fn();
const mockGetAccessMe = vi.fn();
const mockRequestAuthChallenge = vi.fn();
const mockVerifyAuthChallenge = vi.fn();

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => mockUseActiveAccount(),
  useActiveWallet: () => mockUseActiveWallet(),
  useActiveWalletConnectionStatus: () => mockUseActiveWalletConnectionStatus(),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
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
    mockUseActiveAccount.mockReset();
    mockUseActiveWallet.mockReset();
    mockUseActiveWalletConnectionStatus.mockReset();
    mockDisconnect.mockReset();
    mockGetAccessMe.mockReset();
    mockRequestAuthChallenge.mockReset();
    mockVerifyAuthChallenge.mockReset();
    import.meta.env.VITE_SERVER_URL = "http://127.0.0.1:4321";
    mockUseActiveWallet.mockReturnValue({ id: "wallet-1" });
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

  it("creates a signed session on same-origin production when VITE_SERVER_URL is unset", async () => {
    delete (import.meta.env as Record<string, unknown>).VITE_SERVER_URL;
    const signMessage = vi.fn().mockResolvedValue("0xsigned");

    mockUseActiveWalletConnectionStatus.mockReturnValue("connected");
    mockUseActiveAccount.mockReturnValue({
      address: "0xdef",
      signMessage,
    });
    mockGetAccessMe.mockRejectedValueOnce(new Error("unauthorized"));
    mockRequestAuthChallenge.mockResolvedValue({
      message: "Sign this too",
      nonce: "nonce-2",
      expiresAt: "2026-03-20T00:10:00.000Z",
    });
    mockVerifyAuthChallenge.mockImplementationOnce(async () => {
      window.localStorage.setItem("agency.server.sessionToken", "session-2");
      return {
        sessionToken: "session-2",
        actor: {},
        activeCompany: null,
        accessibleCompanies: [],
      };
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

    expect(mockRequestAuthChallenge).toHaveBeenCalledWith("0xdef");
    expect(signMessage).toHaveBeenCalledWith({ message: "Sign this too" });
    expect(mockVerifyAuthChallenge).toHaveBeenCalledWith({
      walletAddress: "0xdef",
      nonce: "nonce-2",
      message: "Sign this too",
      signature: "0xsigned",
    });
    expect(window.localStorage.getItem("agency.server.sessionToken")).toBe("session-2");
  });

  it("shows a retryable error when signed session verification fails", async () => {
    const signMessage = vi.fn().mockResolvedValue("0xsigned");

    mockUseActiveWalletConnectionStatus.mockReturnValue("connected");
    mockUseActiveAccount.mockReturnValue({
      address: "0xabc",
      signMessage,
    });
    mockGetAccessMe.mockRejectedValue(new Error("unauthorized"));
    mockRequestAuthChallenge.mockResolvedValue({
      message: "Sign this",
      nonce: "nonce-1",
      expiresAt: "2026-03-20T00:10:00.000Z",
    });
    mockVerifyAuthChallenge.mockRejectedValue(new Error("Signature verification failed"));

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
      expect(screen.getByText("Authorization failed")).toBeInTheDocument();
    });
    expect(screen.getByText("Signature verification failed")).toBeInTheDocument();
    expect(screen.getByText("Retry signature")).toBeInTheDocument();
    expect(screen.queryByText("Wallet Auth")).not.toBeInTheDocument();
    expect(screen.queryByText("App Ready")).not.toBeInTheDocument();
  });

  it("clears stale server token and retries the signature flow", async () => {
    const signMessage = vi.fn().mockResolvedValue("0xsigned");

    mockUseActiveWalletConnectionStatus.mockReturnValue("connected");
    mockUseActiveAccount.mockReturnValue({
      address: "0xabc",
      signMessage,
    });
    mockGetAccessMe.mockRejectedValue(new Error("unauthorized"));
    let challengeRequests = 0;
    mockRequestAuthChallenge.mockImplementation(async () => {
      challengeRequests += 1;
      if (challengeRequests === 1) {
        return {
          message: "Sign this",
          nonce: "nonce-1",
          expiresAt: "2026-03-20T00:10:00.000Z",
        };
      }
      if (challengeRequests === 2) {
        expect(window.localStorage.getItem("agency.server.sessionToken")).toBeNull();
        return {
          message: "Sign this again",
          nonce: "nonce-2",
          expiresAt: "2026-03-20T00:10:00.000Z",
        };
      }
      return {
        message: "Sign this again",
        nonce: "nonce-2",
        expiresAt: "2026-03-20T00:10:00.000Z",
      };
    });
    let verifyRequests = 0;
    mockVerifyAuthChallenge.mockImplementation(async () => {
      verifyRequests += 1;
      if (verifyRequests === 1) {
        throw new Error("Signature verification failed");
      }
      if (verifyRequests === 2) {
        window.localStorage.setItem("agency.server.sessionToken", "session-2");
        return {
          sessionToken: "session-2",
          actor: {},
          activeCompany: null,
          accessibleCompanies: [],
        };
      }
      window.localStorage.setItem("agency.server.sessionToken", "session-2");
      return {
        sessionToken: "session-2",
        actor: {},
        activeCompany: null,
        accessibleCompanies: [],
      };
    });

    window.localStorage.setItem("agency.server.sessionToken", "stale-session");

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
      expect(screen.getByText("Authorization failed")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Retry signature"));

    await waitFor(() => {
      expect(screen.getByText("App Ready")).toBeInTheDocument();
    });
    expect(challengeRequests).toBeGreaterThanOrEqual(2);
    expect(mockVerifyAuthChallenge).toHaveBeenLastCalledWith({
      walletAddress: "0xabc",
      nonce: "nonce-2",
      message: "Sign this again",
      signature: "0xsigned",
    });
    expect(window.localStorage.getItem("agency.server.sessionToken")).toBe("session-2");
  });
});
