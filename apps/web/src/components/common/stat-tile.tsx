import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  delta,
  hint,
  loading,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("gap-1 px-4 py-3.5", className)}>
      <div className="text-muted-foreground text-xs font-medium">{label}</div>
      {loading ? (
        <>
          <Skeleton className="mt-1 h-7 w-24" />
          <Skeleton className="mt-1 h-3.5 w-32" />
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <div className="flex min-h-4 flex-wrap items-center gap-x-2 gap-y-0.5">
            {delta}
            {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
          </div>
        </>
      )}
    </Card>
  );
}
