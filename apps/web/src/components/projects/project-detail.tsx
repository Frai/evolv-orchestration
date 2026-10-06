"use client";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDot, TriangleAlert } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { daysBetween, money, moneyShort, pct, shortDate, signedMoneyShort } from "@/lib/construction/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatTile } from "@/components/common/stat-tile";
import { Section } from "@/components/common/section";
import { Delta } from "@/components/common/delta";
import { HealthBadge } from "@/components/common/health";
import { CoStatus } from "@/components/common/co-status";
import { MarginLine } from "@/components/charts/margin-line";
import { cn } from "@/lib/utils";

export function ProjectDetail({ id }: { id: string }) {
  const { companyId, today, settings } = useAppState();
  const f = useAsync(() => apiClient.projects.financials(id), [id]);
  const cos = useAsync(() => apiClient.changeOrders.list(companyId), [companyId]);
  const ms = useAsync(() => apiClient.schedule.milestones(companyId), [companyId]);

  if (!f.data || f.data.project.id !== id) return <Skeleton className="h-96" />;
  const j = f.data;
  const p = j.project;
  const jobCos = (cos.data ?? []).filter((c) => c.projectId === id).sort((a, b) => a.raisedOn.localeCompare(b.raisedOn));
  const jobMs = (ms.data ?? []).filter((m) => m.projectId === id);
  const approvedValue = j.revisedContract - p.contractValue;
  const codeTotals = p.costCodes.reduce((s, c) => ({ budget: s.budget + c.budget, committed: s.committed + c.committed, actual: s.actual + c.actual, forecast: s.forecast + c.forecast }), { budget: 0, committed: 0, actual: 0, forecast: 0 });
  const billedPct = p.billedToDate / j.revisedContract;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/projects/" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-4" /> All projects
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">
              {p.number} · {p.sector}
            </div>
            <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{p.name}</h1>
            <p className="text-muted-foreground text-sm">
              {p.client} · {p.city} · PM {p.pm} · Super {p.superintendent}
            </p>
          </div>
          <HealthBadge health={j.health} className="text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Revised contract" value={moneyShort(j.revisedContract)} hint={approvedValue ? `${moneyShort(p.contractValue)} + ${moneyShort(approvedValue)} approved COs` : "No approved changes"} />
        <StatTile label="Forecast cost at completion" value={moneyShort(j.fac)} hint={`budget ${moneyShort(j.revisedBudget)}`} delta={<Delta value={(j.fac - j.revisedBudget) / j.revisedBudget} goodWhen="down" />} />
        <StatTile
          label="Forecast margin"
          value={pct(j.forecastMargin)}
          delta={<Delta value={j.marginDelta} kind="pts" label="vs award" />}
          className={j.marginDelta <= -0.02 ? "shadow-[inset_0_3px_0_var(--danger)]" : undefined}
        />
        <StatTile label="Complete / billed" value={`${pct(p.pctComplete, 0)} / ${pct(billedPct, 0)}`} hint={`${j.overUnderBilled >= 0 ? "overbilled" : "underbilled"} ${moneyShort(Math.abs(j.overUnderBilled))}`} />
      </div>

      {j.exposure.count ? (
        <Card className="border-primary/40 bg-accent/50 gap-3 px-4 py-4">
          <div className="flex items-start gap-3">
            <TriangleAlert className="text-primary mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug">
                {money(j.exposure.cost)} of cost is in this job with no revenue against it
              </div>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                Crews started {j.exposure.count} change{j.exposure.count === 1 ? "" : "s"} before {j.exposure.count === 1 ? "it was" : "they were"} priced. Approved at estimate ({moneyShort(j.exposure.value)}), forecast margin goes from{" "}
                <span className="text-foreground font-medium">{pct(j.forecastMargin)}</span> back to <span className="text-foreground font-medium">{pct(j.recoverableMargin)}</span>.
              </p>
            </div>
          </div>
          <ul className="divide-primary/15 divide-y text-sm">
            {j.exposure.items.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="tnum text-muted-foreground w-16 shrink-0 text-xs">{c.number}</span>
                <span className="min-w-0 flex-1 leading-snug">{c.title}</span>
                <span className={cn("tnum shrink-0 text-xs", daysBetween(c.raisedOn, today) >= settings.coAgingDays ? "font-semibold text-red-700" : "text-muted-foreground")}>{daysBetween(c.raisedOn, today)} d</span>
                <span className="tnum w-16 shrink-0 text-right font-medium">{moneyShort(c.value)}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/approvals/">Review drafted pricing</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/change-orders/?project=${p.id}`}>All changes on this job</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Forecast margin, last 12 weeks" description="Re-forecast every night by the Cost Forecaster from commitments, actuals and open changes.">
          <MarginLine points={p.marginHistory} original={j.originalMargin} target={settings.targetMarginPct} />
        </Section>
        <Section title="Schedule" description={`Substantial completion ${shortDate(p.forecastCompletion)}${j.slipDays ? `, ${j.slipDays} days past baseline` : ", on baseline"}.`}>
          {ms.loading && !ms.data ? (
            <Skeleton className="h-40" />
          ) : (
            <ol className="flex flex-col gap-2">
              {jobMs.map((m) => {
                const slip = daysBetween(m.baseline, m.forecast);
                return (
                  <li key={m.id} className="flex items-center gap-2.5 text-sm">
                    {m.status === "done" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : <CircleDot className={cn("size-4 shrink-0", m.status === "on_track" ? "text-muted-foreground" : "text-amber-600")} />}
                    <span className={cn("min-w-0 flex-1", m.status === "done" && "text-muted-foreground")}>{m.name}</span>
                    <span className="tnum text-muted-foreground text-xs">{shortDate(m.forecast)}</span>
                    <span className={cn("tnum w-12 text-right text-xs", slip >= 7 && m.status !== "done" ? "font-semibold text-amber-700" : "text-muted-foreground")}>{slip ? `+${slip} d` : "—"}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </div>

      <Section title="Cost by code" description="Budget vs committed vs actual vs forecast at completion. Variance is forecast minus budget." bodyClassName="px-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Cost code</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Committed</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Forecast</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {p.costCodes.map((c) => {
              const v = c.forecast - c.budget;
              return (
                <TableRow key={c.code}>
                  <TableCell>
                    <span className="text-muted-foreground mr-2 font-mono text-xs">{c.code}</span>
                    {c.name}
                  </TableCell>
                  <TableCell className="text-right">{money(c.budget)}</TableCell>
                  <TableCell className="text-right">{money(c.committed)}</TableCell>
                  <TableCell className="text-right">{money(c.actual)}</TableCell>
                  <TableCell className="text-right">{money(c.forecast)}</TableCell>
                  <TableCell className={cn("text-right font-medium", v > c.budget * 0.02 ? "text-red-700" : v < 0 ? "text-emerald-700" : "text-muted-foreground")}>{signedMoneyShort(v)}</TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/40 font-medium">
              <TableCell>Base scope</TableCell>
              <TableCell className="text-right">{money(codeTotals.budget)}</TableCell>
              <TableCell className="text-right">{money(codeTotals.committed)}</TableCell>
              <TableCell className="text-right">{money(codeTotals.actual)}</TableCell>
              <TableCell className="text-right">{money(codeTotals.forecast)}</TableCell>
              <TableCell className="text-right">{signedMoneyShort(codeTotals.forecast - codeTotals.budget)}</TableCell>
            </TableRow>
            {j.exposure.cost ? (
              <TableRow className="bg-accent/50">
                <TableCell className="font-medium">Field-started changes, unpriced</TableCell>
                <TableCell className="text-muted-foreground text-right">—</TableCell>
                <TableCell className="text-muted-foreground text-right">—</TableCell>
                <TableCell className="text-right">{money(Math.round(j.exposure.cost * 0.6))}</TableCell>
                <TableCell className="text-right">{money(j.exposure.cost)}</TableCell>
                <TableCell className="text-right font-medium text-red-700">{signedMoneyShort(j.exposure.cost)}</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Section>

      <Section title="Change orders on this job" bodyClassName="px-0">
        {cos.loading && !cos.data ? (
          <div className="px-4">
            <Skeleton className="h-32" />
          </div>
        ) : (
          <ul className="divide-y">
            {jobCos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span className="tnum text-muted-foreground w-16 text-xs">{c.number}</span>
                <span className="min-w-0 flex-1 basis-48 leading-snug">
                  {c.title}
                  {c.fieldStarted && (c.status === "unpriced" || c.status === "pricing" || c.status === "submitted") ? <span className="text-primary ml-2 text-xs font-medium">Work started</span> : null}
                </span>
                <CoStatus status={c.status} />
                <span className="tnum w-20 text-right font-medium">{money(c.value)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
