"use client";
import { useMemo } from "react";
import { addDays } from "@evolv/contracts/dates";
import { RULES } from "@evolv/contracts/alerts";
import { billingLag, missingChangeOrders, receivables, ticketAgeDays, ticketLeakage, ticketPipeline } from "@evolv/contracts/billing";
import { jobEvm } from "@evolv/contracts/evm";
import type { ChangeOrderStatus, InvoiceStatus, TicketStatus } from "@evolv/contracts/types";
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

const TICKET_LABEL: Record<TicketStatus, string> = {
  open: "Awaiting signature",
  signed: "Signed",
  submitted: "Submitted to client",
  approved: "Approved by client",
  disputed: "Disputed",
  paid: "Paid",
};
const TICKET_VARIANT: Record<TicketStatus, "warning" | "info" | "muted" | "success" | "danger"> = {
  open: "warning",
  signed: "info",
  submitted: "muted",
  approved: "success",
  disputed: "danger",
  paid: "success",
};
const INVOICE_VARIANT: Record<InvoiceStatus, "muted" | "info" | "success" | "danger"> = { draft: "muted", issued: "info", paid: "success", overdue: "danger" };
const CO_VARIANT: Record<ChangeOrderStatus, "muted" | "warning" | "success" | "danger"> = { draft: "muted", pending: "warning", approved: "success", rejected: "danger" };

export function BillingPage() {
  const { company, jobId, asOf, snapshot } = useAppState();
  const scoped = useMemo(() => (snapshot ? scopeSnapshot(snapshot, jobId) : undefined), [snapshot, jobId]);

  const view = useMemo(() => {
    if (!scoped) return undefined;
    const graceDate = addDays(asOf, -RULES.billingGraceDays);
    const lags = scoped.jobs.map((job) => ({ job, lag: billingLag(job, jobEvm(job, scoped.codes, scoped.costDays, graceDate), scoped.invoices) }));
    const leak = ticketLeakage(scoped.tickets, asOf);
    const missing = missingChangeOrders(scoped.codes, scoped.costDays, scoped.changeOrders, asOf);
    const stuck = [
      ...leak.disputed.map((t) => ({ t, why: t.disputeReason ?? "Disputed by the client." })),
      ...leak.unsigned.map((t) => ({ t, why: `Unsigned for ${ticketAgeDays(t, asOf)} days.` })),
      ...leak.unsubmitted.map((t) => ({ t, why: `Signed ${ticketAgeDays(t, asOf)} days ago, not submitted.` })),
    ];
    return {
      lags,
      lagTotal: lags.reduce((a, r) => a + r.lag.lag, 0),
      leak,
      stuck,
      pipeline: ticketPipeline(scoped.tickets),
      missing,
      missingTotal: missing.reduce((a, m) => a + m.cost, 0),
      recv: receivables(scoped.invoices, asOf),
    };
  }, [scoped, asOf]);

  const jobName = useMemo(() => new Map((snapshot?.jobs ?? []).map((j) => [j.id, j.name])), [snapshot]);
  const maxPipeline = view ? Math.max(1, ...view.pipeline.map((p) => p.amount)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Billing" description={`${company?.name}. From work performed to cash: field tickets, progress invoices and change orders.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Earned, not invoiced" loading={!view} value={view ? moneyCompact(view.lagTotal) : "—"} hint={`past the ${RULES.billingGraceDays}-day cycle`} />
        <StatTile label="Field tickets stuck" loading={!view} value={view ? moneyCompact(view.leak.atRisk) : "—"} hint={view ? `${view.stuck.length} tickets before billing` : undefined} />
        <StatTile label="Booked, no change order" loading={!view} value={view ? moneyCompact(view.missingTotal) : "—"} hint={view ? `${view.missing.length} extra-work ${view.missing.length === 1 ? "code" : "codes"}` : undefined} />
        <StatTile label="Overdue receivables" loading={!view} value={view ? moneyCompact(view.recv.overdue) : "—"} hint={view ? `${moneyCompact(view.recv.outstanding)} outstanding` : undefined} />
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">Field tickets</TabsTrigger>
          <TabsTrigger value="invoices">Progress billing</TabsTrigger>
          <TabsTrigger value="cos">Change orders</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4 flex flex-col gap-4">
          <Section title="Ticket pipeline" description="Where every field ticket sits between the lease and the client's invoice system.">
            {!view ? (
              <Skeleton className="h-40" />
            ) : (
              <ul className="flex flex-col gap-2.5">
                {view.pipeline.map((p) => (
                  <li key={p.status} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-3 text-sm">
                    <span>{TICKET_LABEL[p.status]}</span>
                    <span className="bg-muted h-2 overflow-hidden rounded-full">
                      <span className="bg-primary/70 block h-full rounded-full" style={{ width: `${(p.amount / maxPipeline) * 100}%` }} />
                    </span>
                    <span className="tnum text-right">
                      {p.count} · {moneyCompact(p.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Stuck before billing" description="Unsigned past three days, signed but unsubmitted past five, and anything disputed.">
            {!view ? (
              <Skeleton className="h-32" />
            ) : view.stuck.length ? (
              <div className="-mx-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Why it is stuck</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.stuck.map(({ t, why }) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <div className="font-medium">{t.number}</div>
                          <div className="text-muted-foreground text-xs">
                            {shortDate(t.date)} · {t.crew}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-48 truncate">{jobName.get(t.jobId)}</TableCell>
                        <TableCell>
                          <Badge variant={TICKET_VARIANT[t.status]}>{TICKET_LABEL[t.status]}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-64 text-sm whitespace-normal">{why}</TableCell>
                        <TableCell className="text-right">{money(t.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState title="Nothing stuck" description="Every ticket past the sign-off window has been signed and submitted." />
            )}
          </Section>
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 flex flex-col gap-4">
          <Section title="Earned vs invoiced" description={`Work earned as of ${shortDate(addDays(asOf, -RULES.billingGraceDays))}, so work inside the normal billing cycle is not counted as late.`}>
            {!view ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead className="text-right">Earned</TableHead>
                      <TableHead className="text-right">Invoiced</TableHead>
                      <TableHead className="text-right">Not yet invoiced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.lags.map(({ job, lag }) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{job.name}</TableCell>
                        <TableCell className="text-right">{money(lag.earned)}</TableCell>
                        <TableCell className="text-right">{money(lag.billed)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={lag.lagPct >= RULES.billingLagCriticalPct ? "danger" : lag.lagPct >= RULES.billingLagPct ? "warning" : "success"}>{money(lag.lag)}</Badge>
                          <div className="text-muted-foreground text-xs">{pct(lag.lagPct, 0)} of earned</div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
          <Section title="Progress invoices">
            {!scoped ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Period end</TableHead>
                      <TableHead>Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoped.invoices.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.number}</TableCell>
                        <TableCell className="max-w-48 truncate">{jobName.get(i.jobId)}</TableCell>
                        <TableCell>{shortDate(i.periodEnd)}</TableCell>
                        <TableCell>{i.dueDate ? shortDate(i.dueDate) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={INVOICE_VARIANT[i.status]}>{i.status === "draft" ? "Draft, not sent" : i.status[0].toUpperCase() + i.status.slice(1)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{money(i.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </TabsContent>

        <TabsContent value="cos" className="mt-4 flex flex-col gap-4">
          <Section title="Booked with no change order" description="Cost on extra-work codes outside the original estimate. This comes straight out of margin unless it is documented and billed.">
            {!view ? (
              <Skeleton className="h-24" />
            ) : view.missing.length ? (
              <ul className="flex flex-col divide-y">
                {view.missing.map((m) => (
                  <li key={m.codeId} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        {m.code} {m.name}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {jobName.get(m.jobId)} · {int(m.hours)} h since {shortDate(m.firstDate)}
                      </div>
                    </div>
                    <Badge variant="danger">{money(m.cost)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Every extra-work code is covered" description="Each has a pending or approved change order on file." />
            )}
          </Section>
          <Section title="Change orders on file">
            {!scoped ? (
              <Skeleton className="h-24" />
            ) : scoped.changeOrders.length ? (
              <div className="-mx-2 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoped.changeOrders.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.number}</TableCell>
                        <TableCell className="max-w-48 truncate">{jobName.get(c.jobId)}</TableCell>
                        <TableCell className="max-w-64 truncate">{c.title}</TableCell>
                        <TableCell>
                          <Badge variant={CO_VARIANT[c.status]}>{c.status === "pending" ? "With client" : c.status[0].toUpperCase() + c.status.slice(1)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{money(c.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState title="No change orders yet" />
            )}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
