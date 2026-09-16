"use client";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { adapters } from "@/adapters";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { rangeEndingAt } from "@/core/dates";
import { flaggedShifts, labourPct, type FlaggedShift } from "@/core/labour";
import { findDay, sumBy } from "@/core/sales";
import { hours, money, pct, shortDateWeekday, signedPts } from "@/core/format";
import type { Approval } from "@/core/types";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { StatTile } from "@/components/common/stat-tile";
import { Delta } from "@/components/common/delta";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { LabourPctLine } from "@/components/charts/labour-pct-line";
import { HoursBars } from "@/components/charts/hours-bars";
import { ScheduleProposalDialog } from "./schedule-proposal-dialog";

type Window = 7 | 30;

export function LabourPage() {
  const { locationId, outletId, asOf, location, settings } = useAppState();
  const [win, setWin] = useState<Window>(30);
  const range = rangeEndingAt(asOf, win);
  const [proposal, setProposal] = useState<FlaggedShift | null>(null);

  const data = useAsync(async () => {
    const [salesDays, labourDays] = await Promise.all([
      adapters.sales.getSalesDays({ locationId, outletId, range }),
      adapters.labour.getLabourDays({ locationId, outletId, range }),
    ]);
    return { salesDays, labourDays };
  }, [locationId, outletId, asOf, win]);

  const salesDays = data.data?.salesDays ?? [];
  const labourDays = data.data?.labourDays ?? [];
  const totalSales = sumBy(salesDays, (d) => d.netSales);
  const totalCost = sumBy(labourDays, (d) => d.labourCost);
  const overall = totalSales ? totalCost / totalSales : null;
  const points = labourDays.map((l) => ({ date: l.date, value: labourPct(l, findDay(salesDays, l.date)) }));
  const over = flaggedShifts(labourDays, "overstaffed");
  const under = flaggedShifts(labourDays, "understaffed");
  const target = settings.targetLabourPct;
  const daysOver = points.filter((p) => p.value !== null && p.value > target).length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Labour" description={`${location?.name}, last ${win} days to ${asOf}. Target ${pct(target, 0)} of sales.`}>
        <Tabs value={String(win)} onValueChange={(v) => setWin(Number(v) as Window)}>
          <TabsList aria-label="Window">
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Labour % of sales" loading={data.loading} value={overall !== null ? pct(overall) : "—"} delta={<Delta value={overall !== null ? overall - target : null} kind="pts" goodWhen="down" />} hint="vs target" />
        <StatTile label="Labour cost" loading={data.loading} value={money(totalCost)} hint={`on ${money(totalSales)} sales`} />
        <StatTile label="Hours worked" loading={data.loading} value={hours(sumBy(labourDays, (d) => d.actualHours))} hint={`${hours(sumBy(labourDays, (d) => d.scheduledHours))} scheduled`} />
        <StatTile label="Days over target" loading={data.loading} value={`${daysOver} of ${points.length}`} hint={daysOver ? `${signedPts(Math.max(...points.map((p) => (p.value ?? 0) - target)))} worst` : "all under"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Labour cost % of sales" description="Daily, with the target line.">
          {data.loading ? <Skeleton className="h-56" /> : points.length ? <LabourPctLine points={points} target={target} /> : <EmptyState title="No labour data in this window" />}
        </Section>
        <Section title="Scheduled vs actual hours" description="Where the floor ran heavier or lighter than the schedule.">
          {data.loading ? <Skeleton className="h-56" /> : labourDays.length ? <HoursBars days={labourDays} /> : <EmptyState title="No labour data in this window" />}
        </Section>
      </div>

      <Section title="Overstaffed shifts" description="Shifts with at least two more people than the sales in that window justified.">
        {data.loading ? (
          <div className="flex flex-col gap-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : over.length ? (
          <ul className="flex flex-col divide-y">
            {over.map((o) => (
              <li key={`${o.date}-${o.shift.id}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{shortDateWeekday(o.date)}</span>
                    <span className="text-muted-foreground text-sm">{o.shift.role} · {o.shift.start}–{o.shift.end}</span>
                    {o.shift.id.includes(":") && location?.outlets ? (
                      <Badge variant="muted">{location.outlets.find((x) => x.id === o.shift.id.split(":")[0])?.name ?? ""}</Badge>
                    ) : null}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-sm">
                    {o.shift.actualStaff} on for {money(o.shift.salesInWindow)} in sales; {o.shift.neededStaff} needed. About <span className="text-foreground font-medium">{money(o.costImpact)}</span> avoidable.
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setProposal(o)}>
                  <CalendarClock /> Suggest schedule change
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No overstaffed shifts" description="Every shift in this window was within one person of what sales justified." />
        )}
      </Section>

      {under.length ? (
        <Section title="Understaffed shifts" description="Shifts that ran at least two people short of what sales needed.">
          <ul className="flex flex-col divide-y">
            {under.map((u) => (
              <li key={`${u.date}-${u.shift.id}`} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{shortDateWeekday(u.date)}</span>
                  <span className="text-muted-foreground text-sm">{u.shift.role} · {u.shift.start}–{u.shift.end}</span>
                </div>
                <div className="text-muted-foreground mt-0.5 text-sm">
                  {u.shift.actualStaff} worked against {u.shift.scheduledStaff} scheduled, through a {money(u.shift.salesInWindow)} window.
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <ScheduleProposalDialog flagged={proposal} onClose={() => setProposal(null)} buildApproval={(f) => buildProposal(f, locationId)} />
    </div>
  );
}

function buildProposal(f: FlaggedShift, locationId: string): Approval {
  const weekly = f.hoursInWindow * f.shift.hourlyRate * 1.08;
  const wd = shortDateWeekday(f.date).slice(0, 3);
  return {
    id: `${locationId}-schedule-${f.date}-${f.shift.id}`,
    locationId,
    agentId: "labour-optimizer",
    title: `Cut one ${f.shift.role.toLowerCase()} from ${wd} ${f.shift.start}–${f.shift.end} shift`,
    summary: `${shortDateWeekday(f.date)} ran ${f.shift.actualStaff} ${f.shift.role.toLowerCase()}s for ${money(f.shift.salesInWindow)} in sales; ${f.shift.neededStaff} would have covered it. Dropping one head saves about ${money(weekly)} a week if the pattern holds.`,
    amount: weekly,
    evidence: [
      { label: "Staff on shift", value: `${f.shift.actualStaff} (needed ${f.shift.neededStaff})`, href: "/labour/" },
      { label: "Sales in window", value: money(f.shift.salesInWindow), href: "/labour/" },
      { label: "Avoidable labour", value: money(f.costImpact), href: "/labour/" },
    ],
    status: "pending",
    proposedAt: new Date().toISOString(),
    confirmation: "Schedule updated. Affected staff notified for next week.",
    action: `Reduce ${wd} ${f.shift.start}–${f.shift.end} ${f.shift.role.toLowerCase()} shift from ${f.shift.actualStaff} to ${f.shift.actualStaff - 1} starting next week.`,
  };
}
