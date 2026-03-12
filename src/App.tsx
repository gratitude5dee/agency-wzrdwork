import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "./pages/NotFound.tsx";
import { AppShell } from "./features/cockpit/components/AppShell";
import { CockpitPage } from "./features/cockpit/pages/CockpitPage";
import { DetailPage } from "./features/cockpit/pages/DetailPage";
import { SectionPage } from "./features/cockpit/pages/SectionPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/cockpit" replace />} />
          <Route path="/" element={<AppShell />}>
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
            <Route path="agents/:agentId" element={<DetailPage kind="agent" />} />
            <Route path="org" element={<SectionPage section="org" />} />
            <Route path="costs" element={<SectionPage section="costs" />} />
            <Route path="activity" element={<SectionPage section="activity" />} />
            <Route path="design-guide" element={<SectionPage section="design-guide" />} />
            <Route path="settings" element={<SectionPage section="settings" />} />
            <Route path="runs/:runId" element={<DetailPage kind="run" />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
