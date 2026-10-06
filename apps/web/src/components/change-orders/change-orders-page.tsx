"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Hammer, X } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import type { ChangeOrder, ChangeOrderStatus } from "@/lib/construction/types";
import { daysBetween, money, moneyShort } from "@/lib/construction/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CO_STAGES, CoStatus } from "@/components/common/co-status";
import { cn } from "@/lib/utils";

type Filter = "started" | ChangeOrderStatus | "all";
const OPEN = new Set<ChangeOrderStatus>(["unpriced", "pricing", "submitted"]);

export function ChangeOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { companyId, company, today, settings } = useAppState();
  const params = useSearchParams();
  const router = useRouter();
  const projectFilter = params.get("project");
  const cos = useAsync(() => apiClient.changeOrders.list(companyId), [companyId]);
  const projects = useAsync(() => apiClient.projects.list(companyId), [companyId]);
  const [filter, setFilter] = useState<Filter>("started");

  const all = (cos.data ?? []).filter((c) => projects.data?.some((p) => p.id === c.projectId));
  const scoped = projectFilter ? all.filter((c) => c.projectId === projectFilter) : all;
  const scopedProject = projects.data?.find((p) => p.id === projectFilter);
  const started = scoped.filter((c) => OPEN.has(c.status) && c.fieldStarted);
  const age = (c: ChangeOrder) => daysBetween(c.raisedOn, today);

  const rows = scoped
    .filter((c) => (filter === "all" ? true : filter === "started" ? OPEN.has(c.status) && c.fieldStarted : c.status === filter))
    .sort((a, b) => (filter === "started" ? age(b) - age(a) : a.raisedOn.localeCompare(b.raisedOn)));
  const projectName = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Change orders" description={`Every change event in ${company?.systems.pm}, from first RFI to billed. The money leaks between "work started" and "priced".`} />

      {scopedProject ? (
        <div className="bg-muted inline-flex w-fit items-center gap-2 rounded-full py-1 pr-1 pl-3 text-sm">
          {scopedProject.name}
          <button onClick={() => router.replace("/change-orders/")} className="hover:bg-background grid size-6 cursor-pointer place-items-center rounded-full" aria-label="Clear job filter">
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {!cos.data || !projects.data ? (
        <Skeleton className="h-28" />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setFilter("started")}
            className={cn("bg-card flex cursor-pointer items-center gap-4 rounded-xl border px-4 py-3.5 text-left shadow-xs transition-colors", filter === "started" ? "border-primary ring-primary/30 ring-2" : "hover:bg-muted/40")}
          >
            <span className="bg-accent text-primary grid size-10 shrink-0 place-items-center rounded-lg">
              <Hammer className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="eyebrow block">Work started, not yet approved</span>
              <span className="block text-lg font-semibold tracking-tight">
                {moneyShort(started.reduce((s, c) => s + c.value, 0))} across {started.length} change{started.length === 1 ? "" : "s"}
              </span>
              <span className="text-muted-foreground block text-xs">
                {money(started.reduce((s, c) => s + c.cost, 0))} of cost already in the forecast. {started.filter((c) => age(c) >= settings.coAgingDays).length} older than {settings.coAgingDays} days.
              </span>
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {CO_STAGES.map((s) => {
              const items = scoped.filter((c) => c.status === s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFilter(s.id)}
                  className={cn("bg-card flex cursor-pointer flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors", filter === s.id ? "border-primary ring-primary/30 ring-2" : "hover:bg-muted/40")}
                >
                  <CoStatus status={s.id} />
                  <span className="tnum mt-1 text-lg font-semibold">{moneyShort(items.reduce((a, c) => a + c.value, 0))}</span>
                  <span className="text-muted-foreground text-xs">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{filter === "started" ? "Started in the field, oldest first" : filter === "all" ? "All changes" : CO_STAGES.find((s) => s.id === filter)?.label}</h2>
            {filter !== "all" ? (
              <button onClick={() => setFilter("all")} className="text-primary cursor-pointer text-sm font-medium underline-offset-2 hover:underline">
                Show all
              </button>
            ) : null}
          </div>

          {rows.length === 0 ? (
            <EmptyState title="Nothing here" description="No change orders in this stage." />
          ) : (
            <>
              <div className="flex flex-col gap-2 md:hidden">
                {rows.map((c) => (
                  <Card key={c.id} className="gap-1.5 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="tnum text-muted-foreground text-xs">
                        {c.number} · {projectName(c.projectId)}
                      </span>
                      <CoStatus status={c.status} />
                    </div>
                    <div className="text-sm leading-snug font-medium">{c.title}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn(OPEN.has(c.status) && age(c) >= settings.coAgingDays ? "font-semibold text-red-700" : "text-muted-foreground")}>
                        {age(c)} days old{c.fieldStarted && OPEN.has(c.status) ? " · work started" : ""}
                      </span>
                      <span className="tnum text-sm font-semibold">{money(c.value)}</span>
                    </div>
                  </Card>
                ))}
              </div>
              <Card className="hidden py-0 md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Change</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead className="text-right">Age</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="max-w-80">
                          <div className="truncate font-medium">{c.title}</div>
                          <div className="text-muted-foreground text-xs">
                            {c.number}
                            {c.reference ? ` · ${c.reference}` : ""}
                            {c.fieldStarted && OPEN.has(c.status) ? <span className="text-primary ml-1.5 font-medium">· Work started</span> : null}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-48">
                          <Link href={`/projects/?id=${c.projectId}`} className="block truncate underline-offset-2 hover:underline">
                            {projectName(c.projectId)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{c.origin}</TableCell>
                        <TableCell className={cn("text-right", OPEN.has(c.status) && age(c) >= settings.coAgingDays ? "font-semibold text-red-700" : "")}>{age(c)} d</TableCell>
                        <TableCell>
                          <CoStatus status={c.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-right">{money(c.cost)}</TableCell>
                        <TableCell className="text-right font-medium">{money(c.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
