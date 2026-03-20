import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface MetricCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  description?: ReactNode;
  to?: string;
  onClick?: () => void;
  trend?: "up" | "down" | "neutral";
}

export function MetricCard({ icon: Icon, value, label, description, to, onClick, trend }: MetricCardProps) {
  const isClickable = !!(to || onClick);

  const inner = (
    <div
      className={cn(
        "h-full px-4 py-4 sm:px-5 sm:py-5 rounded-lg border border-white/10 bg-[#0d1118] transition-colors",
        isClickable && "hover:bg-accent/50 cursor-pointer hover:border-blue-500/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-zinc-100">
            {value}
          </p>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
            {label}
          </p>
          {description && (
            <div className="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">{description}</div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1.5 shrink-0 mt-1">
          <Icon className="h-4 w-4 text-muted-foreground/50" />
          {trend && trend !== "neutral" && (
            <span className={cn("flex items-center", trend === "up" ? "text-emerald-400" : "text-red-400")}>
              {trend === "up" ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="no-underline text-inherit h-full block" onClick={onClick}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div className="h-full" onClick={onClick}>
        {inner}
      </div>
    );
  }

  return inner;
}
