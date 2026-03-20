/**
 * OnboardingGate — wraps the main app.
 *
 * After auth, checks onboarding state. If not completed, shows
 * OnboardingFlow instead of children (AppShell). Returning users
 * (onboarding_completed=true) go directly to the app.
 */

import type { ReactNode } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { OnboardingFlow } from "./OnboardingFlow";

interface OnboardingGateProps {
  children: ReactNode;
}

export function OnboardingGate({ children }: OnboardingGateProps) {
  const account = useActiveAccount();
  const mockWallet = import.meta.env.VITE_DEV_MOCK_WALLET as string | undefined;
  const walletAddress = account?.address ?? mockWallet ?? null;

  // Dev bypass: skip onboarding ONLY when explicitly opted-in.
  // VITE_DEV_SKIP_AUTH bypasses the auth gate but NOT onboarding,
  // so first-time users still see the onboarding wizard.
  const skipOnboarding = import.meta.env.VITE_DEV_SKIP_ONBOARDING === "true";

  const onboarding = useOnboardingState(walletAddress);

  // Skip onboarding only when explicitly requested
  if (skipOnboarding) {
    return <>{children}</>;
  }

  // Still loading onboarding state
  if (onboarding.isLoading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-black text-zinc-500">
        <p className="text-sm uppercase tracking-[0.2em]">Loading…</p>
      </div>
    );
  }

  // Onboarding not completed — show the flow
  if (!onboarding.isCompleted && walletAddress) {
    return <OnboardingFlow walletAddress={walletAddress} />;
  }

  // Onboarding completed or no wallet (auth will handle the latter)
  return <>{children}</>;
}
