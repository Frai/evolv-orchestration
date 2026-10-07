import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { signedPct, signedPts } from "@evolv/contracts/format";

/**
 * Signed delta with direction arrow. `goodWhen` says which direction is good for this metric.
 * `kind` = "pct" formats a ratio delta, "pts" a percentage-point delta.
 */
export function Delta({
  value,
  goodWhen = "up",
  kind = "pct",
  label,
  className,
}: {
  value: number | null | undefined;
  goodWhen?: "up" | "down";
  kind?: "pct" | "pts";
  label?: string;
  className?: string;
}) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className={cn("text-muted-foreground text-xs", className)}>No baseline yet</span>;
  }
  const flat = Math.abs(value) < 0.005;
  const good = flat ? null : (value > 0) === (goodWhen === "up");
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const text = kind === "pct" ? signedPct(value, 1) : signedPts(value, 1);
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-0.5 text-xs font-medium",
        flat ? "text-muted-foreground" : good ? "text-emerald-700" : "text-red-700",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {text}
      {label ? <span className="text-muted-foreground ml-1 font-normal">{label}</span> : null}
    </span>
  );
}
