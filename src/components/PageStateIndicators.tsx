/**
 * Reusable loading, empty, and recoverable error state components for pages.
 *
 * VAL-POLISH-001: Core pages show intentional loading, empty, and recoverable
 * error states rather than blank or broken screens.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* ------------------------------------------------------------------ */
/*  Loading state                                                      */
/* ------------------------------------------------------------------ */

export interface PageLoadingStateProps {
  /** Descriptive label shown beneath the spinner (e.g. "Loading agents…") */
  label?: string;
  /** Number of skeleton card rows to render (default 3) */
  rows?: number;
}

/**
 * Full-page skeleton loading indicator with an animated spinner and optional
 * skeleton card rows. Used when a page is fetching its primary data.
 */
export function PageLoadingState({ label = "Loading…", rows = 3 }: PageLoadingStateProps) {
  return (
    <div className="space-y-4 p-6" data-testid="page-loading-state">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="grid gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Card key={i} className="border-white/10 bg-[#0d1118]">
            <CardContent className="p-4">
              <Skeleton className="h-5 w-48 bg-zinc-800" />
              <Skeleton className="mt-2 h-4 w-32 bg-zinc-800" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

export interface PageEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Centered empty-state card with icon, heading, description, and optional
 * action. Used when a page loaded successfully but has no data to display.
 */
export function PageEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: PageEmptyStateProps) {
  return (
    <Card className="border-white/10 bg-[#0d1118]" data-testid="page-empty-state">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <Icon className="h-12 w-12 text-zinc-600" />
        <div>
          <p className="font-bold text-zinc-300">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-zinc-500">{description}</p>
          )}
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Recoverable error state                                            */
/* ------------------------------------------------------------------ */

export interface PageErrorStateProps {
  /** Human-readable error message */
  message?: string;
  /** Callback invoked when the user clicks "Retry" */
  onRetry?: () => void;
}

/**
 * Prominent recoverable error banner with a retry button. Used when a page's
 * primary data query fails so the operator can attempt recovery.
 */
export function PageErrorState({
  message = "Something went wrong while loading this page.",
  onRetry,
}: PageErrorStateProps) {
  return (
    <div className="p-6" data-testid="page-error-state">
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-400" />
          <div>
            <p className="font-bold text-red-300">Failed to load</p>
            <p className="mt-1 text-sm text-zinc-400">{message}</p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              onClick={onRetry}
              className="border-red-500/20 text-red-300 hover:bg-red-500/10 hover:text-red-200"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
