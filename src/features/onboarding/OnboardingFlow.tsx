/**
 * OnboardingFlow — Main container with step navigation.
 *
 * Shows instead of main app when user hasn't completed onboarding.
 * 5 steps: Company Setup → CEO Agent Creation → Harness Selector → Skill Selection → Feature Tour.
 * Persists current_step via useOnboardingState so refreshing mid-onboarding
 * resumes at the correct step.
 */

import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { CompanySetup } from "./steps/CompanySetup";
import { CeoAgentCreation } from "./steps/CeoAgentCreation";
import { AgentHarnessSelector } from "./steps/AgentHarnessSelector";
import { SkillSelection } from "./steps/SkillSelection";
import { FeatureTour } from "./steps/FeatureTour";

interface OnboardingFlowProps {
  walletAddress: string;
}

const STEP_LABELS = ["Company", "CEO Agent", "Harness", "Skills", "Tour"];

export function OnboardingFlow({ walletAddress }: OnboardingFlowProps) {
  const onboarding = useOnboardingState(walletAddress);

  // Local step state, initialized from persisted state
  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  // Sync from persisted state on load
  useEffect(() => {
    if (!onboarding.isLoading && onboarding.currentStep > 0) {
      setStep(onboarding.currentStep);
    }
    if (onboarding.companyId && onboarding.companyId !== "pending") {
      setCompanyId(onboarding.companyId);
    }
  }, [onboarding.isLoading, onboarding.currentStep, onboarding.companyId]);

  const goToStep = useCallback(
    (newStep: number) => {
      setStep(newStep);
      onboarding.setStep(newStep);
    },
    [onboarding],
  );

  const handleCompanyComplete = useCallback(
    (id: string) => {
      setCompanyId(id);
      goToStep(1);
    },
    [goToStep],
  );

  const handleCeoComplete = useCallback(
    (id: string) => {
      setAgentId(id);
      goToStep(2);
    },
    [goToStep],
  );

  const handleHarnessComplete = useCallback(() => {
    goToStep(3);
  }, [goToStep]);

  const handleSkillsComplete = useCallback(() => {
    goToStep(4);
  }, [goToStep]);

  const handleTourComplete = useCallback(() => {
    onboarding.markCompleted();
  }, [onboarding]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      goToStep(step - 1);
    }
  }, [step, goToStep]);

  if (onboarding.isLoading) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-black text-zinc-500">
        <p className="text-sm uppercase tracking-[0.2em]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="dark flex min-h-screen flex-col bg-black text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-[#0d1118]">
            <Zap className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-zinc-500">
              Agency
            </p>
            <h1 className="text-sm font-black uppercase tracking-[0.08em] text-zinc-100">
              Getting Started
            </h1>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors",
                  i === step
                    ? "bg-blue-500/20 text-blue-400"
                    : i < step
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-zinc-800 text-zinc-600",
                )}
              >
                <span className="mr-1.5 text-[10px]">{i + 1}</span>
                {label}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={cn(
                    "h-px w-4",
                    i < step ? "bg-emerald-500/40" : "bg-zinc-800",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Back button */}
      {step > 0 && (
        <div className="px-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      )}

      {/* Step content */}
      <main className="flex flex-1 items-start justify-center px-6 py-8">
        {step === 0 && (
          <CompanySetup walletAddress={walletAddress} onComplete={handleCompanyComplete} />
        )}
        {step === 1 && companyId && (
          <CeoAgentCreation
            companyId={companyId}
            walletAddress={walletAddress}
            onComplete={handleCeoComplete}
          />
        )}
        {step === 2 && agentId && (
          <AgentHarnessSelector agentId={agentId} onComplete={handleHarnessComplete} />
        )}
        {step === 3 && agentId && companyId && (
          <SkillSelection agentId={agentId} companyId={companyId} onComplete={handleSkillsComplete} />
        )}
        {step === 4 && <FeatureTour onComplete={handleTourComplete} />}

        {/* Fallback if data not ready for current step */}
        {step === 1 && !companyId && (
          <div className="text-center text-zinc-500">
            <p>Please complete company setup first.</p>
            <Button variant="outline" className="mt-4" onClick={() => goToStep(0)}>
              Go to Company Setup
            </Button>
          </div>
        )}
        {step === 2 && !agentId && (
          <div className="text-center text-zinc-500">
            <p>Please create your CEO agent first.</p>
            <Button variant="outline" className="mt-4" onClick={() => goToStep(1)}>
              Go to CEO Agent Creation
            </Button>
          </div>
        )}
        {step === 3 && (!agentId || !companyId) && (
          <div className="text-center text-zinc-500">
            <p>Please complete previous steps first.</p>
            <Button variant="outline" className="mt-4" onClick={() => goToStep(0)}>
              Go to Company Setup
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
