export function getClientWalletAddress(explicit?: string | null): string | null {
  if (explicit && explicit.trim() !== "") {
    return explicit;
  }

  const mockWallet = import.meta.env.VITE_DEV_MOCK_WALLET as string | undefined;
  return mockWallet ?? null;
}
