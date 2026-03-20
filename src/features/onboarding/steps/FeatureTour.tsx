/**
 * Onboarding Step 4: Feature Tour
 *
 * Tooltip-based guided tour highlighting 7 sections:
 * Cockpit, Dashboard, Kanban, OrgChart, Agents, Integrations, Settings.
 * 'Skip Tour' button available.
 *
 * This component renders a simulated tour since we're not inside the AppShell
 * during onboarding. It shows a walkthrough of key features with descriptions.
 */

import { useState, useCallback } from "react";
import { ArrowRight, MapPin, SkipForward } from "lucide-react";
import {
  Workflow,
  LayoutDashboard,
  CheckCircle2,
  Bot,
  Plug,
  Settings,
  GitBranch,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FeatureTourProps {
  onComplete: () => void;
}

interface TourStop {
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const TOUR_STOPS: TourStop[] = [
  {
    title: "Sandbox",
    description:
      "Your mission control center. Monitor live agent runs, view 3D office visualization, and manage active tasks in real-time.",
    icon: Workflow,
    color: "text-blue-400",
  },
  {
    title: "Dashboard",
    description:
      "Track key metrics at a glance: agent count, open issues, live runs, and pending approvals with interactive charts.",
    icon: LayoutDashboard,
    color: "text-emerald-400",
  },
  {
    title: "Kanban Board",
    description:
      "Drag-and-drop task management with 7 status columns. Organize issues from backlog to done with real-time sync.",
    icon: CheckCircle2,
    color: "text-amber-400",
  },
  {
    title: "Org Chart",
    description:
      "Visualize your agent hierarchy as an interactive SVG tree. Pan, zoom, and see reporting relationships at a glance.",
    icon: GitBranch,
    color: "text-violet-400",
  },
  {
    title: "Agents",
    description:
      "Manage your AI agent fleet. Create agents, assign roles, configure harness adapters, and monitor their ERC-8004 identities.",
    icon: Bot,
    color: "text-pink-400",
  },
  {
    title: "Integrations",
    description:
      "Connect external services: Venice AI, Uniswap, Bankr, MetaMask delegations, and more. Toggle and configure each integration.",
    icon: Plug,
    color: "text-orange-400",
  },
  {
    title: "Settings",
    description:
      "Company settings, wallet configuration, and onboarding controls. Replay this tour anytime from here.",
    icon: Settings,
    color: "text-zinc-400",
  },
];

export function FeatureTour({ onComplete }: FeatureTourProps) {
  const [currentStop, setCurrentStop] = useState(0);

  const handleNext = useCallback(() => {
    if (currentStop < TOUR_STOPS.length - 1) {
      setCurrentStop((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStop, onComplete]);

  const currentTour = TOUR_STOPS[currentStop];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#080c14]">
          <MapPin className="h-6 w-6 text-cyan-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">Quick Tour</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Let's walk through the key areas of your new agent OS.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2">
        {TOUR_STOPS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentStop(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === currentStop ? "w-8 bg-blue-500" : "w-2 bg-zinc-700 hover:bg-zinc-600",
            )}
            aria-label={`Go to tour stop ${i + 1}`}
          />
        ))}
      </div>

      {/* Current tour stop card */}
      <Card className="border-white/10 bg-[#0d1118]">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#080c14]",
            )}
          >
            <currentTour.icon className={cn("h-8 w-8", currentTour.color)} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-100">{currentTour.title}</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-400">
              {currentTour.description}
            </p>
          </div>
          <p className="text-xs text-zinc-600">
            {currentStop + 1} of {TOUR_STOPS.length}
          </p>
        </CardContent>
      </Card>

      {/* Tour stop thumbnails */}
      <div className="flex justify-center gap-3 overflow-x-auto pb-2">
        {TOUR_STOPS.map((stop, i) => (
          <button
            key={stop.title}
            onClick={() => setCurrentStop(i)}
            className={cn(
              "flex shrink-0 flex-col items-center gap-1 rounded-xl border px-3 py-2 transition-colors",
              i === currentStop
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-white/10 bg-[#080c14] hover:border-white/20",
            )}
          >
            <stop.icon className={cn("h-4 w-4", i === currentStop ? stop.color : "text-zinc-600")} />
            <span className={cn("text-[10px]", i === currentStop ? "text-zinc-200" : "text-zinc-600")}>
              {stop.title}
            </span>
          </button>
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onComplete} className="text-zinc-500 hover:text-zinc-300">
          <SkipForward className="mr-2 h-4 w-4" />
          Skip Tour
        </Button>
        <Button onClick={handleNext}>
          {currentStop < TOUR_STOPS.length - 1 ? (
            <>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          ) : (
            "Finish Tour"
          )}
        </Button>
      </div>
    </div>
  );
}
