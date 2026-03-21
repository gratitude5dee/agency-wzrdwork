import { useState, useCallback, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

/** Error boundary that silently skips children on failure (used for cinematic intro). */
class IntroBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_e: Error, _info: ErrorInfo) { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import { AppShell } from "./features/cockpit/components/AppShell";
import { CockpitPage } from "./features/cockpit/pages/CockpitPage";
import { DetailPage } from "./features/cockpit/pages/DetailPage";
import { SectionPage } from "./features/cockpit/pages/SectionPage";
import { OrgChart } from "./pages/OrgChart";
import { AgentsPage } from "./pages/Agents";
import { AgentDetailPage } from "./pages/AgentDetail";
import { NewAgentPage } from "./pages/NewAgent";
import { IntegrationsPage } from "./pages/Integrations";
import { SkillsPage } from "./pages/Skills";
import { DelegationsPage } from "./pages/Delegations";
import { SubmissionProofPage } from "./pages/SubmissionProof";
import { ChatPage } from "./pages/Chat";
import { PluginManagerPage } from "./pages/PluginManager";
import { BudgetQuotaPage } from "./pages/BudgetQuota";
import { AssetsDocumentsPage } from "./pages/AssetsDocuments";
import { ExecutionWorkspacesPage } from "./pages/ExecutionWorkspaces";
import { InviteSettingsPage } from "./pages/InviteSettings";
import { ThirdwebProvider } from "@/providers/ThirdwebProvider";
import { AuthGate } from "@/components/AuthGate";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import { SupabaseLiveUpdates } from "@/components/SupabaseLiveUpdates";
import Landing from "./pages/Landing";
import AuthPage from "./pages/AuthPage";

const CinematicIntro = lazy(() => import("@/components/CinematicIntro"));

const queryClient = new QueryClient();

const App = () => {
  const [introComplete, setIntroComplete] = useState(() => {
    // Only show intro once per session
    return sessionStorage.getItem("wzrd-intro-seen") === "true";
  });

  const handleIntroComplete = useCallback(() => {
    sessionStorage.setItem("wzrd-intro-seen", "true");
    setIntroComplete(true);
  }, []);

  return (
    <ThirdwebProvider>
      <QueryClientProvider client={queryClient}>
        <SupabaseLiveUpdates />
        <TooltipProvider>
          <Toaster />
          <Sonner />

          {/* Cinematic intro on first visit */}
          {!introComplete && (
            <IntroBoundary onError={handleIntroComplete}>
              <Suspense fallback={null}>
                <CinematicIntro onComplete={handleIntroComplete} />
              </Suspense>
            </IntroBoundary>
          )}

          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<AuthPage />} />

              {/* Authenticated routes */}
              <Route
                path="/*"
                element={
                  <AuthGate>
                    <OnboardingGate>
                      <Routes>
                        <Route path="/" element={<AppShell />}>
                          <Route index element={<Navigate to="/cockpit" replace />} />
                          <Route path="cockpit" element={<CockpitPage />} />
                          <Route path="dashboard" element={<SectionPage section="dashboard" />} />
                          <Route path="inbox" element={<SectionPage section="inbox" />} />
                          <Route path="issues" element={<SectionPage section="issues" />} />
                          <Route path="issues/:issueId" element={<DetailPage kind="issue" />} />
                          <Route path="goals" element={<SectionPage section="goals" />} />
                          <Route path="approvals" element={<SectionPage section="approvals" />} />
                          <Route path="approvals/:approvalId" element={<DetailPage kind="approval" />} />
                          <Route path="projects" element={<SectionPage section="projects" />} />
                          <Route path="projects/:projectId" element={<DetailPage kind="project" />} />
                          <Route path="agents" element={<AgentsPage />} />
                          <Route path="agents/new" element={<NewAgentPage />} />
                          <Route path="agents/:id" element={<AgentDetailPage />} />
                          <Route path="org" element={<SectionPage section="org" />} />
                          <Route path="org-chart" element={<OrgChart />} />
                          <Route path="costs" element={<SectionPage section="costs" />} />
                          <Route path="activity" element={<SectionPage section="activity" />} />
                          <Route path="integrations" element={<IntegrationsPage />} />
                          <Route path="skills" element={<SkillsPage />} />
                          <Route path="delegations" element={<DelegationsPage />} />
                          <Route path="submission-proof" element={<SubmissionProofPage />} />
                          <Route path="chat" element={<ChatPage />} />
                          <Route path="chat/:sessionId" element={<ChatPage />} />
                          <Route path="design-guide" element={<SectionPage section="design-guide" />} />
                          <Route path="settings" element={<SectionPage section="settings" />} />
                          <Route path="runs/:runId" element={<DetailPage kind="run" />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </OnboardingGate>
                  </AuthGate>
                }
              />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThirdwebProvider>
  );
};

export default App;
