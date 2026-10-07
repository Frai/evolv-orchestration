"use client";
import Link from "next/link";
import { useState } from "react";
import { ChevronRight, UserRound } from "lucide-react";
import type { Alert } from "@evolv/contracts/types";
import { SEVERITY_META, SeverityIcon } from "@/components/common/severity";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SOURCE_PAGE } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/** Every signal is a self-explaining record: what happened, the evidence behind it, what to do, and who owns it. */
function AlertDetail({ alert, onClose }: { alert: Alert | null; onClose: () => void }) {
  return (
    <Dialog open={!!alert} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {alert ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Badge variant={alert.severity === "critical" ? "danger" : alert.severity === "warning" ? "warning" : "info"}>{SEVERITY_META[alert.severity].label}</Badge>
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                  <UserRound className="size-3.5" /> Owner: {alert.owner}
                </span>
              </div>
              <DialogTitle className="text-left leading-snug">{alert.title}</DialogTitle>
              <DialogDescription className="text-left">{alert.detail}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium">Evidence</div>
                <dl className="divide-y rounded-lg border">
                  {alert.evidence.map((e) => (
                    <div key={e.label} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm">
                      <dt className="text-muted-foreground">{e.label}</dt>
                      <dd className="tnum text-right font-medium">{e.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium">Suggested action</div>
                <p className="bg-accent/60 rounded-lg px-3 py-2 text-sm leading-relaxed">{alert.suggestedAction}</p>
              </div>
              <Link href={alert.href} className="text-primary text-sm font-medium underline-offset-2 hover:underline" onClick={onClose}>
                Open {SOURCE_PAGE[alert.source]} to drill into the source rows
              </Link>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function AlertsStrip({ alerts, loading }: { alerts: Alert[] | undefined; loading: boolean }) {
  const [open, setOpen] = useState<Alert | null>(null);
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
    return <EmptyState title="No signals right now" description="Margin, billing, labour, materials and safety are all inside their thresholds." />;
  }
  return (
    <>
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setOpen(a)}
              className={cn("flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:brightness-[0.98]", SEVERITY_META[a.severity].className)}
            >
              <SeverityIcon severity={a.severity} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{a.title}</span>
                <span className="block text-xs opacity-80">{a.detail}</span>
              </span>
              <ChevronRight className="mt-0.5 size-4 shrink-0 opacity-60" />
            </button>
          </li>
        ))}
      </ul>
      <AlertDetail alert={open} onClose={() => setOpen(null)} />
    </>
  );
}
