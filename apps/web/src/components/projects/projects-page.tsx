"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { moneyShort, pct, signedPts } from "@/lib/construction/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HealthBadge, ProgressBar } from "@/components/common/health";
import { ProjectDetail } from "./project-detail";
import { cn } from "@/lib/utils";

export function ProjectsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const id = useSearchParams().get("id");
  const { companyId } = useAppState();
  const project = useAsync(() => (id ? apiClient.projects.get(id) : Promise.resolve(undefined)), [id]);
  // A deep link into another tenant's job falls back to the list.
  if (id && project.data && project.data.companyId === companyId) return <ProjectDetail id={id} />;
  if (id && project.loading) return <Skeleton className="h-64" />;
  return <ProjectList />;
}

function ProjectList() {
  const { companyId, company } = useAppState();
  const pf = useAsync(() => apiClient.portfolio.get(companyId), [companyId]);
  const p = pf.data?.company.id === companyId ? pf.data : undefined;
  const jobs = p ? [...p.jobs].sort((a, b) => a.marginDelta - b.marginDelta) : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Projects" description={`${company?.name}: every active job, worst margin first. Cost from ${company?.systems.accounting}, budgets and changes from ${company?.systems.pm}.`} />

      {!p ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 md:hidden">
            {jobs.map((j) => (
              <Link key={j.project.id} href={`/projects/?id=${j.project.id}`}>
                <Card className="gap-2 px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-muted-foreground tnum text-xs">{j.project.number}</div>
                      <div className="font-medium leading-snug">{j.project.name}</div>
                    </div>
                    <HealthBadge health={j.health} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-muted-foreground text-[11px]">Contract</div>
                      <div className="tnum font-medium">{moneyShort(j.revisedContract)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Margin</div>
                      <div className={cn("tnum font-medium", j.marginDelta <= -0.02 && "text-red-700")}>{pct(j.forecastMargin)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-[11px]">Unpriced</div>
                      <div className="tnum font-medium">{j.exposure.value ? moneyShort(j.exposure.value) : "—"}</div>
                    </div>
                  </div>
                  <ProgressBar value={j.project.pctComplete} />
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="w-36">Complete</TableHead>
                  <TableHead className="text-right">At award</TableHead>
                  <TableHead className="text-right">Forecast</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Unpriced work</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.project.id} className="cursor-pointer">
                    <TableCell className="max-w-72">
                      <Link href={`/projects/?id=${j.project.id}`} className="block">
                        <div className="truncate font-medium">{j.project.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {j.project.number} · {j.project.sector} · PM {j.project.pm}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{moneyShort(j.revisedContract)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ProgressBar value={j.project.pctComplete} className="w-20" />
                        <span className="text-xs">{pct(j.project.pctComplete, 0)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">{pct(j.originalMargin)}</TableCell>
                    <TableCell className="text-right font-semibold">{pct(j.forecastMargin)}</TableCell>
                    <TableCell className={cn("text-right text-xs font-medium", j.marginDelta <= -0.02 ? "text-red-700" : j.marginDelta < -0.005 ? "text-amber-700" : "text-emerald-700")}>{signedPts(j.marginDelta)}</TableCell>
                    <TableCell className="text-right">{j.exposure.value ? <span className="font-medium text-red-700">{moneyShort(j.exposure.value)}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <HealthBadge health={j.health} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/?id=${j.project.id}`} aria-label={`Open ${j.project.name}`}>
                        <ChevronRight className="text-muted-foreground size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
