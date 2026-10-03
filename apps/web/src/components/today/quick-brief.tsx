import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { Approval } from "@evolv/contracts/types";
import type { BriefInput } from "@evolv/contracts/brief";
import { index, money, pct } from "@evolv/contracts/format";
import { Delta } from "@/components/common/delta";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function StatRow({ label, value, delta, hint, tone }: { label: string; value: string; delta?: React.ReactNode; hint?: string; tone?: "bad" }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm">{label}</span>
      <span className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right">
        <span className={cn("tnum font-semibold", tone === "bad" && "text-red-700")}>{value}</span>
        {delta}
        {hint ? <span className="text-muted-foreground w-full text-right text-xs sm:w-auto">{hint}</span> : null}
      </span>
    </div>
  );
}

/** Numbers and actions only, for the ten seconds before the morning huddle. The narrative lives in "At a glance". */
export function QuickBrief({ input, loading, pendingApprovals, approvalsLoading, targetMarginPct }: { input: BriefInput | null; loading: boolean; pendingApprovals: Approval[]; approvalsLoading: boolean; targetMarginPct: number }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-7" />
        ))}
      </div>
    );
  }
  if (!input) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="divide-y">
        {input.jobs.map((j) => (
          <StatRow
            key={j.jobId}
            label={j.name}
            value={pct(j.marginAtCompletion)}
            tone={j.marginAtCompletion < targetMarginPct - 0.03 ? "bad" : undefined}
            delta={<Delta value={j.marginDelta} kind="pts" />}
            hint={`CPI ${index(j.cpi)} · ${pct(j.pctComplete, 0)} complete`}
          />
        ))}
        {input.unbilledWork > 0 ? <StatRow label="Earned, past the billing cycle" value={money(input.unbilledWork)} hint="not yet invoiced" /> : null}
        {input.missingChangeOrderCost > 0 ? <StatRow label="Booked with no change order" value={money(input.missingChangeOrderCost)} tone="bad" /> : null}
      </div>

      <div>
        <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
          Needs your OK
          {pendingApprovals.length ? <span className="bg-primary text-primary-foreground tnum rounded-full px-1.5 py-0.5 text-[11px] leading-none">{pendingApprovals.length}</span> : null}
        </div>
        {approvalsLoading ? (
          <Skeleton className="h-16" />
        ) : pendingApprovals.length ? (
          <ul className="flex flex-col divide-y">
            {pendingApprovals.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link href="/approvals/" className="hover:bg-muted/60 -mx-1 flex items-center gap-2 rounded-md px-1 py-2">
                  <span className="min-w-0 flex-1 text-sm leading-snug">{a.title}</span>
                  {a.amount ? <span className="tnum text-sm font-medium">{money(a.amount)}</span> : null}
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="size-4 text-emerald-600" /> Nothing needs your approval right now.
          </p>
        )}
        {pendingApprovals.length > 4 ? (
          <Link href="/approvals/" className="text-primary mt-1 inline-block text-xs font-medium underline-offset-2 hover:underline">
            +{pendingApprovals.length - 4} more in Approvals
          </Link>
        ) : null}
      </div>
    </div>
  );
}
