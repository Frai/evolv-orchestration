import type { Alert, ChangeOrder, Company, CostCode, CostDay, FieldTicket, Invoice, Job } from "../domain";
import { WEEKDAY_LONG, addDays, weekday } from "./dates";
import { jobEvm, portfolioMargin, trailingCpi, type JobEvm } from "./evm";
import { overtimePct } from "./labour";
import { billingLag, missingChangeOrders, ticketLeakage } from "./billing";
import { RULES } from "./alerts";

const BILLING_GRACE_DAYS = RULES.billingGraceDays;

export interface BriefJob {
  jobId: string;
  name: string;
  marginAtCompletion: number;
  marginDelta: number | null;
  cpi: number | null;
  trailingCpi: number | null;
  pctComplete: number;
}

export interface BriefInput {
  companyId: string;
  date: string;
  weekdayName: string;
  targetMarginPct: number;
  marginAtCompletion: number;
  /** Portfolio forecast margin one week earlier. */
  marginPrev: number | null;
  marginDelta: number | null;
  marginDollars: number;
  jobs: BriefJob[];
  /** Job with the lowest forecast margin relative to target. */
  worstJob: BriefJob | null;
  unbilledWork: number;
  ticketsAtRisk: number;
  missingChangeOrderCost: number;
  overtimePct: number | null;
  overtimePctPrev: number | null;
  criticalAlerts: number;
  warningAlerts: number;
}

export interface BriefData {
  company: Company;
  date: string;
  jobs: Job[];
  codes: CostCode[];
  costDays: CostDay[];
  tickets: FieldTicket[];
  invoices: Invoice[];
  changeOrders: ChangeOrder[];
  alerts: Alert[];
}

/**
 * Computes everything a narrator needs to write the day's brief.
 * Deltas are against the same portfolio one week earlier.
 */
export function buildBriefInput(data: BriefData): BriefInput | null {
  const { company, date, jobs, codes, costDays, tickets, invoices, changeOrders, alerts } = data;
  if (!jobs.length) return null;
  const prevDate = addDays(date, -7);

  const evms: JobEvm[] = jobs.map((j) => jobEvm(j, codes, costDays, date));
  const prevEvms: JobEvm[] = jobs.map((j) => jobEvm(j, codes, costDays, prevDate));
  const port = portfolioMargin(jobs, evms);
  const prevPort = prevEvms.some((e) => e.ac > 0) ? portfolioMargin(jobs, prevEvms) : null;

  const briefJobs: BriefJob[] = jobs.map((j, i) => ({
    jobId: j.id,
    name: j.name,
    marginAtCompletion: evms[i].marginAtCompletion,
    marginDelta: prevEvms[i].ac > 0 ? evms[i].marginAtCompletion - prevEvms[i].marginAtCompletion : null,
    cpi: evms[i].cpi,
    trailingCpi: trailingCpi(j, codes, costDays, date),
    pctComplete: evms[i].pctComplete,
  }));
  const worstJob = [...briefJobs].sort((a, b) => a.marginAtCompletion - b.marginAtCompletion)[0] ?? null;

  const graceDate = addDays(date, -BILLING_GRACE_DAYS);
  const unbilledWork = jobs.reduce((a, j) => a + billingLag(j, jobEvm(j, codes, costDays, graceDate), invoices).lag, 0);
  const ticketsAtRisk = ticketLeakage(tickets, date).atRisk;
  const missing = missingChangeOrders(codes, costDays, changeOrders, date).reduce((a, m) => a + m.cost, 0);
  const week = { from: addDays(date, -6), to: date };
  const prevWeek = { from: addDays(date, -13), to: addDays(date, -7) };

  return {
    companyId: company.id,
    date,
    weekdayName: WEEKDAY_LONG[weekday(date)],
    targetMarginPct: company.targetMarginPct,
    marginAtCompletion: port.marginAtCompletion,
    marginPrev: prevPort ? prevPort.marginAtCompletion : null,
    marginDelta: prevPort ? port.marginAtCompletion - prevPort.marginAtCompletion : null,
    marginDollars: port.marginDollars,
    jobs: briefJobs,
    worstJob,
    unbilledWork,
    ticketsAtRisk,
    missingChangeOrderCost: missing,
    overtimePct: overtimePct(costDays, week),
    overtimePctPrev: overtimePct(costDays, prevWeek),
    criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
    warningAlerts: alerts.filter((a) => a.severity === "warning").length,
  };
}
