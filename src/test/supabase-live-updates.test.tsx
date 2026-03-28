import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const callbacks: Array<() => void> = [];
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const mockChannel = vi.fn();
const mockRemoveChannel = vi.fn();

const channel = {
  on: (...args: unknown[]) => mockOn(...args),
  subscribe: (...args: unknown[]) => mockSubscribe(...args),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

vi.mock("@/hooks/useActiveCompany", () => ({
  useActiveCompany: () => ({
    company: { id: "company-1", name: "Test Co", slug: "test-co", wallet_address: "0x123" },
    companyId: "company-1",
    isLoading: false,
    error: null,
  }),
}));

vi.mock("thirdweb/react", () => ({
  useActiveAccount: () => ({ address: "0x123" }),
}));

describe("SupabaseLiveUpdates", () => {
  beforeEach(() => {
    callbacks.length = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockOn.mockImplementation(
      (_event: unknown, _filter: unknown, callback: () => void) => {
        callbacks.push(callback);
        return channel;
      },
    );
    mockSubscribe.mockReturnValue(channel);
    mockChannel.mockReturnValue(channel);
    mockRemoveChannel.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to the four live tables and invalidates queries on change", async () => {
    const { SupabaseLiveUpdates } = await import("@/components/SupabaseLiveUpdates");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    const invalidateSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);

    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <SupabaseLiveUpdates />
      </QueryClientProvider>,
    );

    expect(mockChannel).toHaveBeenCalledWith("control-plane-live-updates");
    expect(mockOn).toHaveBeenCalledTimes(4);

    callbacks[0]?.();
    expect(invalidateSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(120);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });
});
