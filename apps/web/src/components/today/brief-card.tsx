"use client";
import Link from "next/link";
import { CheckCircle2, ChevronRight, MessageCircle } from "lucide-react";
import type { Approval, Brief } from "@/lib/construction/types";
import type { Portfolio } from "@/lib/construction/core";
import { money, moneyShort, pct, timeOfDay } from "@/lib/construction/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Delta } from "@/components/common/delta";

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

export function BriefCard({ brief, loading, pf, pendingApprovals, approvalsLoading, tz }: { brief: Brief | undefined; loading: boolean; pf: Portfolio | undefined; pendingApprovals: Approval[]; approvalsLoading: boolean; tz: string }) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <div className="eyebrow">Morning brief</div>
          {loading && !brief ? <Skeleton className="mt-1.5 h-5 w-64 max-w-full" /> : <CardTitle className="mt-1 text-lg leading-snug">{brief?.headline}</CardTitle>}
        </div>
        {brief ? (
          <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs">
            <MessageCircle className="size-3.5" /> {timeOfDay(brief.deliveredAt, tz)}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="read">
          <TabsList>
            <TabsTrigger value="read">Read</TabsTrigger>
            <TabsTrigger value="numbers">Numbers</TabsTrigger>
          </TabsList>
          <TabsContent value="read" className="pt-2">
            {loading && !brief ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="mt-2 h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
                {brief?.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="numbers" className="pt-2">
            {!pf ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="divide-y">
                <StatRow label="Forecast margin" value={pct(pf.forecastMargin)} delta={<Delta value={pf.margin4w} kind="pts" label="4 wks" />} hint={`target ${pct(pf.company.targetMarginPct)}`} />
                <StatRow label="Unpriced change work" value={moneyShort(pf.exposure.value)} hint={`${pf.exposure.count} items started in the field`} />
                <StatRow label="Backlog" value={moneyShort(pf.backlog)} hint={`${pf.jobs.length} active jobs`} />
                <StatRow label="Billing position" value={`${pf.overUnderBilled >= 0 ? "Over" : "Under"} ${moneyShort(Math.abs(pf.overUnderBilled))}`} hint="net, all jobs" />
                <StatRow label="Holdback receivable" value={moneyShort(pf.holdbackReceivable)} />
                <StatRow label="Sub pay apps waiting" value={money(pf.payAppsPending.amount)} hint={`${pf.payAppsPending.count} applications`} />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-4 border-t pt-3">
          <div className="eyebrow mb-1.5 flex items-center gap-1.5">
            Needs your OK
            {pendingApprovals.length ? <span className="bg-primary text-primary-foreground tnum rounded-full px-1.5 py-0.5 text-[11px] leading-none tracking-normal">{pendingApprovals.length}</span> : null}
          </div>
          {approvalsLoading ? (
            <Skeleton className="h-16" />
          ) : pendingApprovals.length ? (
            <ul className="flex flex-col divide-y">
              {pendingApprovals.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link href="/approvals/" className="hover:bg-muted/60 -mx-1 flex items-center gap-2 rounded-md px-1 py-2">
                    <span className="min-w-0 flex-1 text-sm leading-snug">{a.title}</span>
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
      </CardContent>
    </Card>
  );
}
