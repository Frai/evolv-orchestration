/** View-model helpers shared by the dashboard pages. Pure functions over the snapshot. */
import type { Alert, Company, Job } from "@evolv/contracts/types";
import { addDays } from "@evolv/contracts/dates";
import { jobEvm, portfolioMargin, type JobEvm } from "@evolv/contracts/evm";
import type { Snapshot } from "@/lib/api-client";

/** The snapshot restricted to one job; the whole snapshot when `jobId` is undefined. */
export function scopeSnapshot(s: Snapshot, jobId: string | undefined): Snapshot {
  if (!jobId) return s;
  const only = <T extends { jobId: string }>(rows: T[]) => rows.filter((r) => r.jobId === jobId);
  return {
    ...s,
    jobs: s.jobs.filter((j) => j.id === jobId),
    codes: only(s.codes),
    costDays: only(s.costDays),
    tickets: only(s.tickets),
    invoices: only(s.invoices),
    changeOrders: only(s.changeOrders),
    equipment: only(s.equipment),
    commitments: only(s.commitments),
    safety: only(s.safety),
  };
}

export function scopeAlerts(alerts: Alert[] | undefined, jobId: string | undefined): Alert[] | undefined {
  if (!alerts || !jobId) return alerts;
  return alerts.filter((a) => a.jobId === jobId);
}

export interface PortfolioStats {
  evms: JobEvm[];
  cpi: number | null;
  /** CPI over the trailing 14 days, across the portfolio. */
  trailingCpi: number | null;
  marginAtCompletion: number;
  marginDollars: number;
  contractValue: number;
}

const ratio = (num: number, den: number) => (den > 0 && num > 0 ? num / den : null);

export function portfolioStats(jobs: Job[], s: Snapshot, asOf: string): PortfolioStats {
  const evms = jobs.map((j) => jobEvm(j, s.codes, s.costDays, asOf));
  const then = jobs.map((j) => jobEvm(j, s.codes, s.costDays, addDays(asOf, -14)));
  const ev = evms.reduce((a, e) => a + e.ev, 0);
  const ac = evms.reduce((a, e) => a + e.ac, 0);
  const dEv = ev - then.reduce((a, e) => a + e.ev, 0);
  const dAc = ac - then.reduce((a, e) => a + e.ac, 0);
  const p = portfolioMargin(jobs, evms);
  return { evms, cpi: ratio(ev, ac), trailingCpi: ratio(dEv, dAc), marginAtCompletion: p.marginAtCompletion, marginDollars: p.marginDollars, contractValue: p.contractValue };
}

export const ACCOUNTING_LABEL: Record<Company["accounting"], string> = {
  sage300cre: "Sage 300 CRE",
  vista: "Viewpoint Vista",
  quickbooks: "QuickBooks",
  netsuite: "NetSuite",
};

export const SOURCE_PAGE: Record<Alert["source"], string> = {
  margin: "Jobs",
  labour: "Labour",
  change_orders: "Billing",
  billing: "Billing",
  tickets: "Billing",
  equipment: "Resources",
  materials: "Resources",
  safety: "Resources",
};
