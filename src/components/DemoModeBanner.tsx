import { AlertTriangle } from "lucide-react";

interface DemoModeBannerProps {
  /** Optional message to show alongside the demo indicator. */
  message?: string;
}

/**
 * A visible banner that indicates the surface is displaying demo/fallback data
 * instead of live Supabase-backed data. Prevents silent mixing of demo and live
 * counts across dashboard and cockpit surfaces.
 */
export function DemoModeBanner({ message }: DemoModeBannerProps) {
  return (
    <div
      data-testid="demo-mode-banner"
      className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
      <span>
        <strong className="font-semibold">Demo mode</strong>
        {" — "}
        {message ?? "Showing demo data. Connect a wallet and set up your company to see live data."}
      </span>
    </div>
  );
}
