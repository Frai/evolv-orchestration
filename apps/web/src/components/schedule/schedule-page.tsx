"use client";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import type { ProcurementStatus } from "@/lib/construction/types";
import { daysBetween, monthYear, possessive, shortDate } from "@/lib/construction/format";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PROC_STATUS: Record<ProcurementStatus, string> = {
  submittal_pending: "Submittal pending",
  released: "Released",
  in_fabrication: "In fabrication",
  shipped: "Shipped",
  delivered: "Delivered",
};

export function SchedulePage() {
  const { companyId, company, today } = useAppState();
  const projects = useAsync(() => apiClient.projects.list(companyId), [companyId]);
  const proc = useAsync(() => apiClient.schedule.procurement(companyId), [companyId]);
  const ms = useAsync(() => apiClient.schedule.milestones(companyId), [companyId]);
  const ready = projects.data && proc.data && ms.data && projects.data[0]?.companyId === companyId;
  const name = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? "";

  if (!ready) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Schedule" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const jobs = [...projects.data!].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const t0 = jobs.reduce((m, p) => (p.startDate < m ? p.startDate : m), jobs[0].startDate);
  const t1 = jobs.reduce((m, p) => (p.forecastCompletion > m ? p.forecastCompletion : m), jobs[0].forecastCompletion);
  const span = daysBetween(t0, t1);
  const x = (d: string) => (daysBetween(t0, d) / span) * 100;
  const items = [...proc.data!].map((i) => ({ ...i, float: daysBetween(i.expectedDelivery, i.needBy) })).sort((a, b) => a.float - b.float);
  const upcoming = ms.data!.filter((m) => m.status !== "done" && m.critical).sort((a, b) => a.forecast.localeCompare(b.forecast)).slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Schedule" description={`Long-lead procurement and milestones across ${possessive(company?.name ?? "")} jobs. A late item on the critical path moves the completion date.`} />

      <Section title="Long-lead items" description="Supplier delivery dates against the date the schedule needs them. Negative float means late." bodyClassName="px-0">
        <div className="flex flex-col divide-y md:hidden">
          {items.map((i) => (
            <div key={i.id} className="flex flex-col gap-0.5 px-4 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm leading-snug font-medium">{i.item}</span>
                <span className={cn("tnum shrink-0 text-sm font-semibold", i.float < 0 ? "text-red-700" : i.float < 7 ? "text-amber-700" : "text-emerald-700")}>{i.float > 0 ? `+${i.float}` : i.float} d</span>
              </div>
              <span className="text-muted-foreground text-xs">
                {name(i.projectId)} · {i.supplier} · needed {shortDate(i.needBy)}, expected {shortDate(i.expectedDelivery)}
              </span>
            </div>
          ))}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Item</TableHead>
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Need by</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Float</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id} className={i.float < 0 ? "bg-red-50/50" : undefined}>
                  <TableCell>
                    <div className="font-medium">{i.item}</div>
                    <div className="text-muted-foreground text-xs">{i.supplier}</div>
                  </TableCell>
                  <TableCell className="max-w-52">
                    <Link href={`/projects/?id=${i.projectId}`} className="block truncate underline-offset-2 hover:underline">
                      {name(i.projectId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{i.leadWeeks} wks</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{PROC_STATUS[i.status]}</TableCell>
                  <TableCell className="text-right">{shortDate(i.needBy)}</TableCell>
                  <TableCell className="text-right">{shortDate(i.expectedDelivery)}</TableCell>
                  <TableCell className={cn("text-right font-semibold", i.float < 0 ? "text-red-700" : i.float < 7 ? "text-amber-700" : "text-emerald-700")}>{i.float > 0 ? `+${i.float}` : i.float} d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Job timelines" description="Start to forecast completion. The tick is the baseline completion date.">
          <div className="flex flex-col gap-3">
            {jobs.map((p) => {
              const slip = daysBetween(p.baselineCompletion, p.forecastCompletion);
              return (
                <Link key={p.id} href={`/projects/?id=${p.id}`} className="group flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium group-hover:underline">{p.name}</span>
                    <span className={cn("tnum shrink-0 text-xs", slip >= 21 ? "font-semibold text-red-700" : slip >= 7 ? "font-semibold text-amber-700" : "text-muted-foreground")}>
                      {shortDate(p.forecastCompletion)}
                      {slip ? ` · +${slip} d` : ""}
                    </span>
                  </div>
                  <div className="bg-muted relative h-3 rounded-sm">
                    <div className="bg-chart-1/25 absolute top-0 h-full rounded-sm" style={{ left: `${x(p.startDate)}%`, width: `${x(p.forecastCompletion) - x(p.startDate)}%` }} />
                    <div className="bg-chart-1 absolute top-0 h-full rounded-l-sm" style={{ left: `${x(p.startDate)}%`, width: `${Math.max(0, x(today) - x(p.startDate))}%` }} />
                    {slip ? <div className={cn("absolute top-0 h-full", slip >= 21 ? "bg-red-600/70" : "bg-amber-500/70")} style={{ left: `${x(p.baselineCompletion)}%`, width: `${x(p.forecastCompletion) - x(p.baselineCompletion)}%` }} /> : null}
                    <div className="bg-foreground absolute -top-0.5 h-4 w-0.5" style={{ left: `${x(p.baselineCompletion)}%` }} />
                  </div>
                </Link>
              );
            })}
            <div className="text-muted-foreground relative mt-1 h-4 text-[10px]">
              <span className="absolute left-0">{monthYear(t0)}</span>
              <span className="absolute -translate-x-1/2 font-medium" style={{ left: `${x(today)}%` }}>
                Today
              </span>
              <span className="absolute right-0">{monthYear(t1)}</span>
            </div>
          </div>
        </Section>

        <Section title="Critical milestones ahead" bodyClassName="px-0">
          <ul className="divide-y">
            {upcoming.map((m) => {
              const slip = daysBetween(m.baseline, m.forecast);
              return (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Card className="tnum w-12 shrink-0 items-center gap-0 rounded-md px-0 py-1 text-center shadow-none">
                    <span className="text-muted-foreground text-[10px] uppercase">{shortDate(m.forecast).split(" ")[0]}</span>
                    <span className="text-sm leading-none font-semibold">{shortDate(m.forecast).split(" ")[1]}</span>
                  </Card>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{m.name}</div>
                    <div className="text-muted-foreground truncate text-xs">{name(m.projectId)}</div>
                  </div>
                  <span className={cn("tnum shrink-0 text-xs", slip >= 7 ? "font-semibold text-amber-700" : "text-muted-foreground")}>{slip ? `+${slip} d` : "On baseline"}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      </div>
    </div>
  );
}
