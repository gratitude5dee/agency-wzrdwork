import { AlertTriangle, LoaderCircle, MonitorOff } from "lucide-react";

export type CockpitSceneStatus = "loading" | "ready" | "unsupported" | "error";

export const COCKPIT_LOG_COLLAPSE_BREAKPOINT = 1500;

export function isCompactCockpitViewport(width: number): boolean {
  return width < COCKPIT_LOG_COLLAPSE_BREAKPOINT;
}

interface CockpitSceneOverlayProps {
  companyName: string;
  errorMessage?: string | null;
  status: CockpitSceneStatus;
}

export function CockpitSceneOverlay({
  companyName,
  errorMessage,
  status,
}: CockpitSceneOverlayProps) {
  if (status === "ready") {
    return null;
  }

  const isLoading = status === "loading";
  const isUnsupported = status === "unsupported";
  const Icon = isLoading ? LoaderCircle : isUnsupported ? MonitorOff : AlertTriangle;
  const label = isLoading
    ? "Loading Scene"
    : isUnsupported
      ? "WebGPU Unsupported"
      : "Scene Error";
  const message = isLoading
    ? `Booting the ${companyName} office and syncing agent positions.`
    : errorMessage ??
      (isUnsupported
        ? "This browser cannot start the WebGPU sandbox runtime."
        : "The sandbox scene failed to initialize.");

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#05070c]/78 px-6 backdrop-blur-sm"
      data-scene-status={status}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#090d15]/95 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start gap-4">
          <div
            className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
              isLoading
                ? "border-blue-500/30 bg-blue-500/12 text-blue-300"
                : isUnsupported
                  ? "border-orange-500/30 bg-orange-500/12 text-orange-300"
                  : "border-red-500/30 bg-red-500/12 text-red-300"
            }`}
          >
            <Icon className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-zinc-500">
              Delegation Sandbox
            </p>
            <h3 className="mt-2 text-xl font-black text-zinc-50">{label}</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">{message}</p>
            {!isLoading && (
              <p className="mt-4 text-[11px] font-medium leading-relaxed text-zinc-500">
                Keep the rest of the sandbox open for issue and approval context, then retry in a
                supported browser session.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
