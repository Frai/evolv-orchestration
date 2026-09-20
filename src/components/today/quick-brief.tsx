import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { Approval } from "@/core/types";
import type { BriefInput } from "@/core/brief";
import { peakWindowLabel } from "@/core/kitchen";
import { int, money, pct } from "@/core/format";
import { Delta } from "@/components/common/delta";
import { Skeleton } from "@/components/ui/skeleton";

function StatRow({ label, value, delta, hint }: { label: string; value: string; delta?: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-sm">{label}</span>
      <span className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-right">
        <span className="tnum font-semibold">{value}</span>
        {delta}
        {hint ? <span className="text-muted-foreground w-full text-right text-xs sm:w-auto">{hint}</span> : null}
      </span>
    </div>
  );
}

/** Numbers and actions only — for the ten seconds before coffee kicks in. The narrative lives in "At a glance". */
export function QuickBrief({ input, loading, pendingApprovals, approvalsLoading, targetLabourPct, roomService }: { input: BriefInput | null; loading: boolean; pendingApprovals: Approval[]; approvalsLoading: boolean; targetLabourPct: number; roomService: boolean }) {
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

  const deliveryValue = input.channels.delivery + input.channels.room_service;

  return (
    <div className="flex flex-col gap-4">
      <div className="divide-y">
        <StatRow label="Net sales" value={money(input.netSales)} delta={<Delta value={input.netSalesDelta} />} />
        <StatRow
          label="Labour"
          value={input.labourPct !== null ? pct(input.labourPct) : "—"}
          delta={<Delta value={input.labourPctDelta} kind="pts" goodWhen="down" />}
          hint={`target ${pct(targetLabourPct, 0)}`}
        />
        <StatRow label="Covers" value={int(input.covers)} delta={<Delta value={input.coversDelta} />} hint={`${money(input.avgCheck)} avg check`} />
        <StatRow label={roomService ? "Room service" : "Delivery"} value={pct(input.deliveryShare, 0)} delta={<Delta value={input.deliveryShareDelta} kind="pts" />} hint={money(deliveryValue)} />
        <StatRow
          label="Kitchen"
          value={input.kitchenSeverity ? (input.kitchenSeverity === "critical" ? "Fell behind" : "Ran hot") : "Kept pace"}
          hint={`${peakWindowLabel(input.kitchenPeakHourIndex)} · ${int(input.kitchenPeakOrders)} tickets vs ${int(input.kitchenCapacity)}/hr`}
        />
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
