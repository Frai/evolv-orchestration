"use client";
import { useMemo, useState } from "react";
import { addDays } from "@evolv/contracts/dates";
import { evmSeries, jobEvm, trailingCodeCpi, trailingCpi } from "@evolv/contracts/evm";
import { CATEGORY_LABEL } from "@evolv/contracts/types";
import { index, money, moneyCompact, pct, shortDate } from "@evolv/contracts/format";
import { useAppState } from "@/components/providers/app-state";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { StatTile } from "@/components/common/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EvmChart } from "@/components/charts/evm-chart";
import { cn } from "@/lib/utils";

const CPI_BAD = 0.95;

function cpiClass(v: number | null) {
  if (v === null) return "text-muted-foreground";
  return v < 0.9 ? "text-red-700 font-semibold" : v < CPI_BAD ? "text-amber-700 font-medium" : "";
}

export function JobsPage() {
  const { company, jobId, asOf, snapshot, settings } = useAppState();
  const [picked, setPicked] = useState<string | undefined>();

  const rows = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.jobs.map((job) => ({ job, evm: jobEvm(job, snapshot.codes, snapshot.costDays, asOf), trailing: trailingCpi(job, snapshot.codes, snapshot.costDays, asOf) }));
  }, [snapshot, asOf]);

  if (!snapshot || !company) {
    return (
      <>
        <PageHeader title="Jobs" description="Earned value per cost code, rolled up to the job." />
        <Skeleton className="h-64" />
      </>
    );
  }

  const target = settings.targetMarginPct;
  const worst = [...rows].sort((a, b) => a.evm.marginAtCompletion - b.evm.marginAtCompletion)[0];
  const activeId = picked ?? jobId ?? worst?.job.id;
  const active = rows.find((r) => r.job.id === activeId) ?? worst;

  return (
    <>
      <PageHeader title="Jobs" description={`Forecast margin is contract value less estimate at completion, as of ${shortDate(asOf)}. Target ${pct(target, 0)}.`} />

      <Section title="All jobs" description="Tap a job to see its cost codes." className="mb-4">
        <div className="-mx-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Complete</TableHead>
                <TableHead className="text-right">CPI</TableHead>
                <TableHead className="text-right">SPI</TableHead>
                <TableHead className="text-right">Estimate at completion</TableHead>
                <TableHead className="text-right">Forecast margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ job, evm, trailing }) => {
                const gap = target - evm.marginAtCompletion;
                return (
                  <TableRow key={job.id} onClick={() => setPicked(job.id)} className={cn("cursor-pointer", job.id === active?.job.id && "bg-accent/50")}>
                    <TableCell>
                      <div className="font-medium">{job.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {job.client} · {job.pm}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{pct(evm.pctComplete, 0)}</TableCell>
                    <TableCell className={cn("text-right", cpiClass(evm.cpi))}>
                      {index(evm.cpi)}
                      <div className={cn("text-xs font-normal", cpiClass(trailing))}>{index(trailing)} last 14d</div>
                    </TableCell>
                    <TableCell className="text-right">{index(evm.spi)}</TableCell>
                    <TableCell className="text-right">
                      {moneyCompact(evm.eac)}
                      <div className="text-muted-foreground text-xs">of {moneyCompact(evm.bac)} budget</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={gap >= 0.08 ? "danger" : gap >= 0.03 ? "warning" : "success"}>{pct(evm.marginAtCompletion)}</Badge>
                      <div className="text-muted-foreground text-xs">bid at {pct(evm.budgetMargin)}</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Section>

      {active ? <JobDetail key={active.job.id} jobId={active.job.id} /> : null}
    </>
  );
}

function JobDetail({ jobId }: { jobId: string }) {
  const { snapshot, asOf, settings } = useAppState();
  const s = snapshot!;
  const job = s.jobs.find((j) => j.id === jobId)!;
  const evm = useMemo(() => jobEvm(job, s.codes, s.costDays, asOf), [job, s, asOf]);
  const trailing = useMemo(() => trailingCpi(job, s.codes, s.costDays, asOf), [job, s, asOf]);
  const points = useMemo(() => {
    const dates: string[] = [];
    for (let d = job.startDate; d <= asOf; d = addDays(d, 1)) dates.push(d);
    return evmSeries(job, s.codes, s.costDays, dates);
  }, [job, s, asOf]);
  const codes = useMemo(() => {
    const jobDays = s.costDays.filter((d) => d.jobId === jobId);
    return evm.codes
      .map((c) => ({ ...c, trailing: trailingCodeCpi(s.codes.find((x) => x.id === c.codeId)!, jobDays, asOf) }))
      .sort((a, b) => a.vac - b.vac);
  }, [evm, s, jobId, asOf]);

  const gap = settings.targetMarginPct - evm.marginAtCompletion;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight">{job.name}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Forecast margin" value={pct(evm.marginAtCompletion)} hint={`${moneyCompact(evm.marginDollars)} · bid at ${pct(evm.budgetMargin)}`} className={gap >= 0.03 ? "border-red-200" : undefined} />
        <StatTile label="Estimate at completion" value={moneyCompact(evm.eac)} hint={`${moneyCompact(evm.bac)} budget · ${moneyCompact(job.contractValue)} contract`} />
        <StatTile label="CPI / SPI" value={`${index(evm.cpi)} / ${index(evm.spi)}`} hint="cost / schedule performance" />
        <StatTile label="CPI, last 14 days" value={index(trailing)} hint={trailing !== null && evm.cpi !== null && trailing < evm.cpi - 0.03 ? "worse than the job average" : "in line with the job average"} />
      </div>

      <Section title="Cost against earned value" description="Dashed line is where the budget said the job would be. When actual cost pulls above earned value, the job is overspending for the work installed.">
        <EvmChart points={points} />
      </Section>

      <Section title="Cost codes" description="Sorted by forecast variance, worst first. Every number traces to daily cost rows.">
        <div className="-mx-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cost code</TableHead>
                <TableHead className="text-right">Budget</TableHead>
                <TableHead className="text-right">Complete</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead className="text-right">CPI</TableHead>
                <TableHead className="text-right">Forecast variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((c) => (
                <TableRow key={c.codeId}>
                  <TableCell>
                    <div className="font-medium">
                      {c.code} {c.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge variant="muted">{CATEGORY_LABEL[c.category]}</Badge>
                      {c.extra ? <Badge variant="warning">Not in the estimate</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{c.extra ? "—" : money(c.bac)}</TableCell>
                  <TableCell className="text-right">{c.extra ? "—" : pct(c.pctComplete, 0)}</TableCell>
                  <TableCell className="text-right">{money(c.ac)}</TableCell>
                  <TableCell className={cn("text-right", cpiClass(c.cpi))}>
                    {c.extra ? "—" : index(c.cpi)}
                    {!c.extra ? <div className={cn("text-xs font-normal", cpiClass(c.trailing))}>{index(c.trailing)} last 14d</div> : null}
                  </TableCell>
                  <TableCell className={cn("text-right", c.vac < -1 ? "font-medium text-red-700" : "text-muted-foreground")}>{c.vac < -1 ? `${money(c.vac)}` : c.vac > 1 ? `+${money(c.vac)}` : "On budget"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </div>
  );
}
