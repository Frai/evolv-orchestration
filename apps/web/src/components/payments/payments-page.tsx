"use client";
import Link from "next/link";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import type { PayAppStatus, Subcontractor } from "@/lib/construction/types";
import { subCompliance } from "@/lib/construction/core";
import { money, moneyShort, pct, shortDate } from "@/lib/construction/format";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { StatTile } from "@/components/common/stat-tile";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PAY_STATUS: Record<PayAppStatus, { label: string; className: string }> = {
  not_received: { label: "Not received", className: "text-muted-foreground" },
  received: { label: "Received", className: "text-sky-800" },
  under_review: { label: "Under review", className: "text-amber-800" },
  approved: { label: "Approved", className: "text-emerald-800" },
  paid: { label: "Paid", className: "text-muted-foreground" },
};

function ComplianceChips({ s, wcbName }: { s: Subcontractor; wcbName: string }) {
  const k = subCompliance(s);
  const chips: { label: string; tone: "bad" | "warn" | "ok" }[] = [
    { label: k.wcbExpired ? `${wcbName} expired` : k.wcbSoon ? `${wcbName} ${k.wcbDays} d` : wcbName, tone: k.wcbExpired ? "bad" : k.wcbSoon ? "warn" : "ok" },
    { label: k.insExpired ? "Insurance expired" : k.insSoon ? `Insurance ${k.insDays} d` : "Insurance", tone: k.insExpired ? "bad" : k.insSoon ? "warn" : "ok" },
    { label: k.lienMissing ? "Lien waiver missing" : "Lien waiver", tone: k.lienMissing ? "warn" : "ok" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span key={c.label} className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", c.tone === "bad" ? "bg-red-100 text-red-800" : c.tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800")}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

export function PaymentsPage() {
  const { companyId, company } = useAppState();
  const pf = useAsync(() => apiClient.portfolio.get(companyId), [companyId]);
  const subs = useAsync(() => apiClient.subs.list(companyId), [companyId]);
  const p = pf.data?.company.id === companyId ? pf.data : undefined;
  const subRows = subs.data?.[0]?.companyId === companyId ? subs.data : undefined;
  const c = company!;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Subs & payments" description={`Billing against work in place, holdback, and what has to be true before a sub gets paid. Holdback at 10% under ${c.province === "ON" ? "Ontario's Construction Act" : c.province === "BC" ? "BC's Builders Lien Act" : "Alberta's Prompt Payment and Construction Lien Act"}.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Billing position" loading={!p} value={p ? `${p.overUnderBilled >= 0 ? "+" : "−"}${moneyShort(Math.abs(p.overUnderBilled))}` : "—"} hint={p ? (p.overUnderBilled >= 0 ? "net overbilled" : "net underbilled") : undefined} />
        <StatTile label="Holdback owed to you" loading={!p} value={p ? moneyShort(p.holdbackReceivable) : "—"} hint="10% of billed to date" />
        <StatTile label="Holdback you owe subs" loading={!p} value={p ? moneyShort(p.holdbackPayable) : "—"} hint="10% of sub billings" />
        <StatTile label="Sub pay apps waiting" loading={!p} value={p ? moneyShort(p.payAppsPending.amount) : "—"} hint={p ? `${p.payAppsPending.count} received or in review` : undefined} />
      </div>

      <Section title="Billing vs work in place" description="Earned revenue is cost-to-cost % complete times revised contract. Underbilling is cash you've earned and not asked for." bodyClassName="px-0">
        {!p ? (
          <div className="px-4">
            <Skeleton className="h-48" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Job</TableHead>
                <TableHead className="text-right">Complete</TableHead>
                <TableHead className="text-right">Earned</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Over / under</TableHead>
                <TableHead className="text-right">Holdback held</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...p.jobs]
                .sort((a, b) => a.overUnderBilled - b.overUnderBilled)
                .map((j) => (
                  <TableRow key={j.project.id}>
                    <TableCell className="max-w-64">
                      <Link href={`/projects/?id=${j.project.id}`} className="block truncate font-medium underline-offset-2 hover:underline">
                        {j.project.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{pct(j.project.pctComplete, 0)}</TableCell>
                    <TableCell className="text-right">{money(j.earnedRevenue)}</TableCell>
                    <TableCell className="text-right">{money(j.project.billedToDate)}</TableCell>
                    <TableCell className={cn("text-right font-semibold", j.overUnderBilled < -50_000 ? "text-red-700" : j.overUnderBilled > 0 ? "text-emerald-700" : "")}>
                      {j.overUnderBilled >= 0 ? "+" : "−"}
                      {moneyShort(Math.abs(j.overUnderBilled))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">{money(j.holdbackReceivable)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Subcontractors" description={`Pay applications this period and the three things Sub Compliance checks before any payment: ${c.wcbName} clearance, insurance and a lien waiver for the last payment.`} bodyClassName="px-0">
        {!subRows ? (
          <div className="px-4">
            <Skeleton className="h-48" />
          </div>
        ) : (
          <>
            <div className="flex flex-col divide-y md:hidden">
              {subRows.map((s) => {
                const k = subCompliance(s);
                return (
                  <div key={s.id} className={cn("flex flex-col gap-1.5 px-4 py-3", k.blocked && "bg-red-50/60")}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium">{s.name}</div>
                        <div className="text-muted-foreground text-xs">{s.trade}</div>
                      </div>
                      <div className="text-right">
                        <div className="tnum text-sm font-semibold">{s.payApp.amount ? money(s.payApp.amount) : "—"}</div>
                        <div className={cn("text-xs", PAY_STATUS[s.payApp.status].className)}>{k.blocked && s.payApp.amount ? "On hold" : PAY_STATUS[s.payApp.status].label}</div>
                      </div>
                    </div>
                    <ComplianceChips s={s} wcbName={c.wcbName} />
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Subcontractor</TableHead>
                    <TableHead className="text-right">Subcontract</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                    <TableHead className="text-right">This pay app</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Compliance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subRows.map((s) => {
                    const k = subCompliance(s);
                    return (
                      <TableRow key={s.id} className={k.blocked ? "bg-red-50/60" : undefined}>
                        <TableCell>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-muted-foreground text-xs">
                            {s.trade} · {s.projectIds.length} job{s.projectIds.length === 1 ? "" : "s"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{moneyShort(s.contractValue)}</TableCell>
                        <TableCell className="text-right">{pct(s.billedToDate / s.contractValue, 0)}</TableCell>
                        <TableCell className="text-right font-medium">{s.payApp.amount ? money(s.payApp.amount) : "—"}</TableCell>
                        <TableCell className={cn("text-xs font-medium", k.blocked && s.payApp.amount ? "text-red-700" : PAY_STATUS[s.payApp.status].className)}>
                          {k.blocked && s.payApp.amount ? "On hold" : PAY_STATUS[s.payApp.status].label}
                          {s.payApp.receivedOn && s.payApp.status !== "paid" ? <div className="text-muted-foreground font-normal">in {shortDate(s.payApp.receivedOn)}</div> : null}
                        </TableCell>
                        <TableCell>
                          <ComplianceChips s={s} wcbName={c.wcbName} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Section>
      <Card className="text-muted-foreground px-4 py-3 text-xs">
        Holdback figures are illustrative. Release timing depends on the certificate of substantial performance and your province&apos;s lien period.
      </Card>
    </div>
  );
}
