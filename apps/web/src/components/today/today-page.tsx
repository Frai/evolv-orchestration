"use client";
import { useMemo } from "react";
import { MessageCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { ACCOUNTING_LABEL, portfolioStats, scopeAlerts, scopeSnapshot } from "@/lib/metrics";
import { addDays } from "@evolv/contracts/dates";
import { buildBriefInput } from "@evolv/contracts/brief";
import { ticketLeakage } from "@evolv/contracts/billing";
import { index, longDate, moneyCompact, pct, timeOfDay } from "@evolv/contracts/format";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/common/stat-tile";
import { Delta } from "@/components/common/delta";
import { Section } from "@/components/common/section";
import { BriefCard } from "./brief-card";
import { AlertsStrip } from "./alerts-strip";
import { AskBox } from "./ask-box";

const CHANNEL_LABEL = { whatsapp: "WhatsApp", email: "Email", both: "WhatsApp & Email" } as const;

export function TodayPage() {
  const { company, companyId, jobId, asOf, settings, approvals, approvalsLoading, snapshot, alerts } = useAppState();
  const co = company!;

  const brief = useAsync(() => apiClient.narrator.getBrief(companyId, asOf), [companyId, asOf]);
  const delivery = useAsync(() => apiClient.notifier.lastDelivery(companyId), [companyId]);

  const scoped = useMemo(() => (snapshot ? scopeSnapshot(snapshot, jobId) : undefined), [snapshot, jobId]);
  const scopedAlerts = useMemo(() => scopeAlerts(alerts, jobId), [alerts, jobId]);

  const stats = useMemo(() => (scoped ? portfolioStats(scoped.jobs, scoped, asOf) : undefined), [scoped, asOf]);
  const input = useMemo(
    () => (scoped && scopedAlerts ? buildBriefInput({ company: co, date: asOf, jobs: scoped.jobs, codes: scoped.codes, costDays: scoped.costDays, tickets: scoped.tickets, invoices: scoped.invoices, changeOrders: scoped.changeOrders, alerts: scopedAlerts }) : null),
    [co, scoped, scopedAlerts, asOf],
  );
  const stuck = useMemo(() => (scoped ? ticketLeakage(scoped.tickets, asOf).atRisk : 0), [scoped, asOf]);
  const loading = !scoped;

  const channelLabel = CHANNEL_LABEL[settings.deliveryChannel];
  const scopeJob = jobId ? snapshot?.jobs.find((j) => j.id === jobId) : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Yesterday</div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{longDate(asOf)}</h1>
          <p className="text-muted-foreground text-sm">
            {co.name} · {scopeJob ? scopeJob.name : `${snapshot?.jobs.length ?? "…"} active jobs`} · Job cost from {ACCOUNTING_LABEL[co.accounting]}
          </p>
        </div>
        <Badge variant="success" className="w-fit gap-1.5 px-2.5 py-1">
          <MessageCircle className="size-3.5" />
          Sent to {channelLabel} {delivery.data ? timeOfDay(delivery.data.sentAt) : "5:45 a.m."}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Forecast margin"
          loading={loading}
          value={stats ? pct(stats.marginAtCompletion) : "—"}
          delta={<Delta value={input?.marginDelta} kind="pts" />}
          hint={`target ${pct(settings.targetMarginPct, 0)} · ${stats ? moneyCompact(stats.marginDollars) : ""}`}
        />
        <StatTile
          label="Cost performance (CPI)"
          loading={loading}
          value={stats ? index(stats.cpi) : "—"}
          hint={stats ? `${index(stats.trailingCpi)} over last 14 days` : undefined}
        />
        <StatTile
          label="Earned, not invoiced"
          loading={loading}
          value={input ? moneyCompact(input.unbilledWork) : "—"}
          hint={stuck > 0 ? `${moneyCompact(stuck)} of tickets stuck` : "past the 14-day billing cycle"}
        />
        <StatTile
          label="Overtime, last 7 days"
          loading={loading}
          value={input?.overtimePct !== null && input?.overtimePct !== undefined ? pct(input.overtimePct, 0) : "—"}
          delta={input?.overtimePct != null && input?.overtimePctPrev != null ? <Delta value={input.overtimePct - input.overtimePctPrev} kind="pts" goodWhen="down" /> : undefined}
          hint="of labour hours"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <BriefCard
            brief={brief.data}
            loading={brief.loading}
            input={input}
            numbersLoading={loading}
            pendingApprovals={approvals.filter((a) => a.status === "pending")}
            approvalsLoading={approvalsLoading}
            targetMarginPct={settings.targetMarginPct}
          />
          <AskBox companyId={companyId} date={asOf} />
        </div>
        <Section title="Signals" description={`Rules run over job cost as of ${longDate(addDays(asOf, 0))}. Tap one for the evidence.`}>
          <AlertsStrip alerts={scopedAlerts} loading={!alerts} />
        </Section>
      </div>
    </div>
  );
}
