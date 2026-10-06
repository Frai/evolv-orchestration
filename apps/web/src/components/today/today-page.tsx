"use client";
import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { longDate, moneyShort, pct, timeOfDay } from "@/lib/construction/format";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatTile } from "@/components/common/stat-tile";
import { Delta } from "@/components/common/delta";
import { Section } from "@/components/common/section";
import { HealthBadge } from "@/components/common/health";
import { BriefCard } from "./brief-card";
import { AlertsStrip } from "./alerts-strip";
import { AskBox } from "./ask-box";
import { cn } from "@/lib/utils";

const CHANNEL_LABEL = { whatsapp: "WhatsApp", email: "Email", both: "WhatsApp & Email" } as const;

export function TodayPage() {
  const { company, companyId, today, settings, approvals, approvalsLoading } = useAppState();
  const c = company!;

  const brief = useAsync(() => apiClient.narrator.getBrief(companyId), [companyId]);
  const pf = useAsync(() => apiClient.portfolio.get(companyId), [companyId]);
  const alerts = useAsync(() => apiClient.portfolio.alerts(companyId, settings.coAgingDays), [companyId, settings.coAgingDays]);
  const p = pf.data && pf.data.company.id === companyId ? pf.data : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">This morning</div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{longDate(today)}</h1>
          <p className="text-muted-foreground text-sm">
            {c.name} · {p ? `${p.jobs.length} active jobs` : "Active jobs"} · {c.city}, {c.province}
          </p>
        </div>
        <Badge variant="success" className="w-fit gap-1.5 px-2.5 py-1">
          <MessageCircle className="size-3.5" />
          Sent to {CHANNEL_LABEL[settings.deliveryChannel]} {brief.data ? timeOfDay(brief.data.deliveredAt, c.timeZone) : "6:00 AM"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Forecast margin"
          loading={!p}
          value={p ? pct(p.forecastMargin) : "—"}
          delta={<Delta value={p?.margin4w} kind="pts" label="4 wks" />}
          hint={`target ${pct(settings.targetMarginPct)}`}
          className={p && p.forecastMargin < settings.targetMarginPct ? "shadow-[inset_0_3px_0_var(--danger)]" : undefined}
        />
        <StatTile
          label="Unpriced change work"
          loading={!p}
          value={p ? moneyShort(p.exposure.value) : "—"}
          hint={p ? `${p.exposure.count} items started, ${p.exposure.jobs} jobs` : undefined}
          className={p && p.exposure.value > 0 ? "shadow-[inset_0_3px_0_var(--primary)]" : undefined}
        />
        <StatTile label="Jobs at risk" loading={!p} value={p ? `${p.atRisk} of ${p.jobs.length}` : "—"} hint={p ? `${p.watch} on watch` : undefined} />
        <StatTile
          label="Billing position"
          loading={!p}
          value={p ? `${p.overUnderBilled >= 0 ? "+" : "−"}${moneyShort(Math.abs(p.overUnderBilled))}` : "—"}
          hint={p ? `${p.overUnderBilled >= 0 ? "net overbilled" : "net underbilled"} · ${moneyShort(p.holdbackReceivable)} holdback` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <BriefCard brief={brief.data?.companyId === companyId ? brief.data : undefined} loading={brief.loading} pf={p} pendingApprovals={approvals.filter((a) => a.status === "pending")} approvalsLoading={approvalsLoading} tz={c.timeZone} />
          <AskBox key={companyId} companyId={companyId} />
        </div>
        <div className="flex flex-col gap-4">
          <Section title="Alerts" description="Rules run over this morning's sync. Tap one to see the source.">
            <AlertsStrip alerts={alerts.data} loading={alerts.loading && !alerts.data} />
          </Section>
          <Section title="Jobs" description="Forecast margin against margin at award." bodyClassName="px-0">
            {!p ? (
              <div className="flex flex-col gap-2 px-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : (
              <ul className="divide-y">
                {[...p.jobs]
                  .sort((a, b) => a.marginDelta - b.marginDelta)
                  .map((j) => (
                    <li key={j.project.id}>
                      <Link href={`/projects/?id=${j.project.id}`} className="hover:bg-muted/60 flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{j.project.name}</div>
                          <div className="text-muted-foreground tnum text-xs">
                            {j.project.number} · {pct(j.project.pctComplete, 0)} complete
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={cn("tnum text-sm font-semibold", j.marginDelta <= -0.02 ? "text-red-700" : j.marginDelta <= -0.006 ? "text-amber-700" : "")}>{pct(j.forecastMargin)}</div>
                          <div className="text-muted-foreground tnum text-[11px]">from {pct(j.originalMargin)}</div>
                        </div>
                        <HealthBadge health={j.health} className="hidden sm:inline-flex" />
                        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
