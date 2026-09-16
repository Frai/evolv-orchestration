"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Alert } from "@/core/types";
import { SEVERITY_META, SeverityIcon } from "@/components/common/severity";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export function AlertsStrip({ alerts, loading }: { alerts: Alert[] | undefined; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }
  if (!alerts || alerts.length === 0) {
    return <EmptyState title="No alerts for this day" description="Sales, labour and stock were all inside their normal ranges." />;
  }
  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((a) => (
        <li key={a.id}>
          <Link
            href={a.href}
            className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:brightness-[0.98]", SEVERITY_META[a.severity].className)}
          >
            <SeverityIcon severity={a.severity} className="mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{a.title}</span>
              <span className="block text-xs opacity-80">{a.detail}</span>
            </span>
            <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-60" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
