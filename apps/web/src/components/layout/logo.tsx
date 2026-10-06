import { cn } from "@/lib/utils";

export function Logo({ className, compact = false, inverted = false }: { className?: string; compact?: boolean; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-[5px] text-sm font-black" aria-hidden>
        <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
          <path d="M2 13h12v1.5H2zM3.5 6h2v6h-2zm3.5-2h2v8H7zm3.5 3h2v5h-2z" />
        </svg>
      </span>
      {!compact && (
        <span className={cn("text-base", inverted && "text-sidebar-foreground")}>
          evolv<span className="text-primary">.</span>build
        </span>
      )}
    </span>
  );
}
