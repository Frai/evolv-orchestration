import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-lg text-sm font-bold" aria-hidden>
        e
      </span>
      {!compact && <span className="text-base">evolv</span>}
    </span>
  );
}
