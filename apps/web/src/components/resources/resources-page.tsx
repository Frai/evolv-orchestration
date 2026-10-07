"use client";
import { useMemo } from "react";
import { materialSlipDays, overdueSafety, daysOverdue, avgUtilization, idleBurn, idleDays, serviceDueInDays, materialsAtRisk } from "@evolv/contracts/resources";
import { int, money, moneyCompact, pct, shortDate } from "@evolv/contracts/format";
import { useAppState } from "@/components/providers/app-state";
import { scopeSnapshot } from "@/lib/metrics";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { StatTile } from "@/components/common/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Fourteen tiny bars, one per day, oldest first: a unit's recent working pattern at a glance. */
function UsageBars({ hours }: { hours: number[] }) {
  return (
    <span className="flex h-6 items-end gap-px" aria-label="Hours used per day, last 14 days">
      {hours.map((h, i) => (
        <span key={i} className={cn("w-1 rounded-sm", h < 1 ? "bg-red-300" : "bg-primary/70")} style={{ height: `${Math.max(8, Math.min(100, (h / 10) * 100))}%` }} />
      ))}
    </span>
  );
}

export function ResourcesPage() {
  const { company, jobId, asOf, snapshot } = useAppState();
  const scoped = useMemo(() => (snapshot ? scopeSnapshot(snapshot, jobId) : undefined), [snapshot, jobId]);
  const jobName = useMemo(() => new Map((snapshot?.jobs ?? []).map((j) => [j.id, j.name])), [snapshot]);

  const view = useMemo(() => {
    if (!scoped) return undefined;
    const rented = scoped.equipment.filter((e) => e.ownership === "rented");
    const utilization = scoped.equipment.length ? scoped.equipment.reduce((a, e) => a + avgUtilization(e), 0) / scoped.equipment.length : 0;
    return {
      burn: rented.reduce((a, e) => a + idleBurn(e, 7), 0),
      utilization,
      late: materialsAtRisk(scoped.commitments),
      overdue: overdueSafety(scoped.safety, asOf),
      openSafety: scoped.safety.filter((s) => s.status === "open"),
    };
  }, [scoped, asOf]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Resources" description={`${company?.name}. What is on site, what is on order, and what is open on the safety side.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Idle rental burn, 7 days" loading={!view} value={view ? moneyCompact(view.burn) : "—"} hint="rented units, days with no work" />
        <StatTile label="Equipment utilization" loading={!view} value={view ? pct(view.utilization, 0) : "—"} hint="14-day average, ten-hour day" />
        <StatTile label="Deliveries landing late" loading={!view} value={view ? String(view.late.length) : "—"} hint="promised after the need date" />
        <StatTile label="Overdue safety actions" loading={!view} value={view ? String(view.overdue.length) : "—"} hint={view ? `${view.openSafety.length} open in total` : undefined} />
      </div>

      <Tabs defaultValue="equipment">
        <TabsList>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="materials">Materials & subs</TabsTrigger>
          <TabsTrigger value="safety">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="mt-4">
          <Section title="Fleet on these jobs" description="Red bars are days with under an hour of use. Rented iron bills every day, worked or not.">
            {!scoped ? (
              <Skeleton className="h-40" />
            ) : scoped.equipment.length ? (
              <div className="-mx-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Unit</TableHead>
                      <TableHead>Last 14 days</TableHead>
                      <TableHead className="text-right">Idle, last 7</TableHead>
                      <TableHead className="text-right">Daily rate</TableHead>
                      <TableHead className="text-right">Service</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoped.equipment.map((e) => {
                      const idle = idleDays(e, 7);
                      const due = serviceDueInDays(e, asOf);
                      return (
                        <TableRow key={e.id}>
                          <TableCell>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                              <Badge variant={e.ownership === "rented" ? "warning" : "muted"}>{e.ownership === "rented" ? "Rented" : "Owned"}</Badge>
                              <span className="max-w-48 truncate">{jobName.get(e.jobId)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <UsageBars hours={e.usageHours14} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={idle >= 5 ? "danger" : idle >= 3 ? "warning" : "muted"}>{idle} days</Badge>
                            {e.ownership === "rented" && idle > 0 ? <div className="text-muted-foreground text-xs">{money(idleBurn(e, 7))} burned</div> : null}
                          </TableCell>
                          <TableCell className="text-right">{money(e.dailyRate)}</TableCell>
                          <TableCell className="text-right">{due === null ? "—" : due <= 7 ? <Badge variant="info">in {due} days</Badge> : shortDate(e.serviceDueDate!)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState title="No equipment on these jobs" />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="materials" className="mt-4">
          <Section title="Purchase orders and subcontracts" description="Vendor promise dates against the dates the schedule needs the material or crew on site.">
            {!scoped ? (
              <Skeleton className="h-40" />
            ) : scoped.commitments.length ? (
              <div className="-mx-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Commitment</TableHead>
                      <TableHead className="text-right">Committed</TableHead>
                      <TableHead className="text-right">Invoiced</TableHead>
                      <TableHead className="text-right">Promised</TableHead>
                      <TableHead className="text-right">Needed</TableHead>
                      <TableHead className="text-right">Float</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoped.commitments.map((c) => {
                      const slip = materialSlipDays(c);
                      const closed = c.status !== "open";
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.description}</div>
                            <div className="text-muted-foreground text-xs">
                              {c.vendor} · {jobName.get(c.jobId)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{money(c.committed)}</TableCell>
                          <TableCell className="text-right">{pct(c.invoiced / c.committed, 0)}</TableCell>
                          <TableCell className="text-right">{shortDate(c.promisedDate)}</TableCell>
                          <TableCell className="text-right">{shortDate(c.needDate)}</TableCell>
                          <TableCell className="text-right">
                            {closed ? <Badge variant="muted">Delivered</Badge> : slip > 0 ? <Badge variant={slip >= 7 ? "danger" : "warning"}>{slip} days late</Badge> : <Badge variant="success">{int(-slip)} days spare</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState title="No open commitments" />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="safety" className="mt-4">
          <Section title="Safety follow-through" description="Evolv routes and reminds. Supervisors always make the safety decisions on site.">
            {!scoped ? (
              <Skeleton className="h-32" />
            ) : scoped.safety.length ? (
              <ul className="flex flex-col divide-y">
                {scoped.safety.map((s) => {
                  const late = s.status === "open" && s.correctiveDue < asOf;
                  return (
                    <li key={s.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{s.title}</div>
                        <div className="text-muted-foreground text-xs">
                          {jobName.get(s.jobId)} · {s.kind.replace("_", " ")} · raised {shortDate(s.date)} · owner {s.owner}
                        </div>
                      </div>
                      {s.status === "closed" ? <Badge variant="success">Closed</Badge> : late ? <Badge variant="danger">Overdue {daysOverdue(s, asOf)} days</Badge> : <Badge variant="info">Due {shortDate(s.correctiveDue)}</Badge>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="No safety events on these jobs" />
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
