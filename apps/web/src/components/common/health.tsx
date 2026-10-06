import type { ProjectHealth } from "@/lib/construction/types";
import { cn } from "@/lib/utils";

export const HEALTH_META: Record<ProjectHealth, { label: string; className: string; dot: string }> = {
  on_track: { label: "On track", className: "bg-emerald-50 text-emerald-800", dot: "bg-emerald-600" },
  watch: { label: "Watch", className: "bg-amber-50 text-amber-900", dot: "bg-amber-500" },
  at_risk: { label: "At risk", className: "bg-red-50 text-red-800", dot: "bg-red-600" },
};

export function HealthBadge({ health, className }: { health: ProjectHealth; className?: string }) {
  const m = HEALTH_META[health];
  return (
    <span className={cn("inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", m.className, className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} aria-hidden />
      {m.label}
    </span>
  );
}

/** Thin horizontal progress bar with an optional second marker (e.g. billed vs complete). */
export function ProgressBar({ value, marker, className }: { value: number; marker?: number; className?: string }) {
  return (
    <div className={cn("bg-muted relative h-1.5 w-full overflow-hidden rounded-full", className)}>
      <div className="bg-chart-1 h-full rounded-full" style={{ width: `${Math.min(100, value * 100)}%` }} />
      {marker !== undefined ? <div className="bg-foreground/70 absolute top-0 h-full w-0.5" style={{ left: `${Math.min(100, marker * 100)}%` }} /> : null}
    </div>
  );
}
