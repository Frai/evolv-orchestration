"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { addDays } from "@evolv/contracts/dates";
import { RULES } from "@evolv/contracts/alerts";
import { hoursByCode, hoursInRange, overtimePct, weeklyHours } from "@evolv/contracts/labour";
import { int, money, pct } from "@evolv/contracts/format";
import { useAppState } from "@/components/providers/app-state";
import { scopeSnapshot } from "@/lib/metrics";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { StatTile } from "@/components/common/stat-tile";
import { Delta } from "@/components/common/delta";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HoursBars } from "@/components/charts/hours-bars";

type Window = 7 | 30;

function otBadge(share: number | null) {
  if (share === null) return <Badge variant="muted">No hours</Badge>;
  const v = share >= RULES.overtimeCriticalPct ? "danger" : share >= RULES.overtimeWarnPct ? "warning" : "success";
  return <Badge variant={v}>{pct(share, 0)}</Badge>;
}

export function LabourPage() {
  const { company, jobId, asOf, snapshot, approvals } = useAppState();
  const [win, setWin] = useState<Window>(7);
  const scoped = useMemo(() => (snapshot ? scopeSnapshot(snapshot, jobId) : undefined), [snapshot, jobId]);

  const view = useMemo(() => {
    if (!scoped) return undefined;
    const range = { from: addDays(asOf, -(win - 1)), to: asOf };
    const prev = { from: addDays(asOf, -(2 * win - 1)), to: addDays(asOf, -win) };
    const { total, overtime } = hoursInRange(scoped.costDays, range);
    const cost = scoped.costDays.filter((d) => d.hours > 0 && d.date >= range.from).reduce((a, d) => a + d.cost, 0);
    const byJob = scoped.jobs.map((j) => {
      const days = scoped.costDays.filter((d) => d.jobId === j.id);
      const h = hoursInRange(days, range);
      return { job: j, hours: h.total, overtime: h.overtime, share: overtimePct(days, range) };
    });
    const names = new Map(scoped.codes.map((c) => [c.id, c]));
    const jobNames = new Map(scoped.jobs.map((j) => [j.id, j.name]));
    const byCode = hoursByCode(scoped.costDays, range)
      .filter((c) => c.hours >= 40)
      .slice(0, 6)
      .map((c) => ({ ...c, code: names.get(c.codeId), jobName: jobNames.get(names.get(c.codeId)?.jobId ?? "") ?? "" }));
    return {
      total,
      overtime,
      cost,
      share: overtimePct(scoped.costDays, range),
      prevShare: overtimePct(scoped.costDays, prev),
      weeks: weeklyHours(scoped.costDays, { from: addDays(asOf, -69), to: asOf }),
      byJob,
      byCode,
      overJobs: byJob.filter((j) => j.share !== null && j.share >= RULES.overtimeWarnPct).length,
    };
  }, [scoped, asOf, win]);

  const proposals = approvals.filter((a) => a.agentId === "labor-analyst" && a.status === "pending");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Labour" description={`${company?.name}, last ${win} days to ${asOf}. Overtime above ${pct(RULES.overtimeWarnPct, 0)} of hours raises a signal.`}>
        <Tabs value={String(win)} onValueChange={(v) => setWin(Number(v) as Window)}>
          <TabsList aria-label="Window">
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Overtime share"
          loading={!view}
          value={view?.share != null ? pct(view.share, 0) : "—"}
          delta={view?.share != null && view?.prevShare != null ? <Delta value={view.share - view.prevShare} kind="pts" goodWhen="down" /> : undefined}
          hint={`vs prior ${win} days`}
        />
        <StatTile label="Labour hours" loading={!view} value={view ? int(view.total) : "—"} hint={view ? `${int(view.overtime)} overtime` : undefined} />
        <StatTile label="Labour cost" loading={!view} value={view ? money(view.cost) : "—"} hint="burdened, all labour codes" />
        <StatTile label="Jobs over the line" loading={!view} value={view ? `${view.overJobs} of ${view.byJob.length}` : "—"} hint={`overtime above ${pct(RULES.overtimeWarnPct, 0)}`} />
      </div>

      {proposals.length ? (
        <Link href="/approvals/" className="bg-accent/60 hover:bg-accent rounded-lg px-3.5 py-2.5 text-sm">
          <span className="font-medium">{proposals[0].title}</span> is waiting for your approval. <span className="text-primary underline-offset-2 hover:underline">Review it</span>
        </Link>
      ) : null}

      <Section title="Weekly labour hours" description="Regular and overtime hours across all labour cost codes, last ten weeks.">
        {!view ? <Skeleton className="h-56" /> : view.weeks.length ? <HoursBars weeks={view.weeks} /> : <EmptyState title="No labour hours recorded" />}
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Overtime by job">
          {!view ? (
            <Skeleton className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Overtime</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.byJob.map((r) => (
                  <TableRow key={r.job.id}>
                    <TableCell className="font-medium">{r.job.name}</TableCell>
                    <TableCell className="text-right">{int(r.hours)}</TableCell>
                    <TableCell className="text-right">{otBadge(r.share)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>

        <Section title="Where the overtime sits" description="Labour cost codes with the heaviest overtime share in this window.">
          {!view ? (
            <Skeleton className="h-32" />
          ) : view.byCode.length ? (
            <ul className="flex flex-col divide-y">
              {view.byCode.map((c) => (
                <li key={c.codeId} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {c.code?.code} {c.code?.name}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {c.jobName} · {int(c.hours)} h
                    </div>
                  </div>
                  {otBadge(c.overtimePct)}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No labour codes with enough hours" />
          )}
        </Section>
      </div>
    </div>
  );
}
