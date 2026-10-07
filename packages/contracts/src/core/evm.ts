// Earned-value management, computed per cost code and rolled up to the job.
//
//   PV  planned value: what the budget says should have been earned by now
//   EV  earned value: budget value of the work actually installed
//   AC  actual cost: what has been spent
//   CPI = EV / AC   (< 1.0: over-spending per unit of work)
//   SPI = EV / PV   (< 1.0: behind schedule)
//   EAC = AC + (BAC - EV) / CPI   (typical-divergence forecast at completion)
//   margin at completion = (contract value - EAC) / contract value
import type { CostCode, CostDay, Job } from "../domain";
import { addDays, daysBetween } from "./dates";

export interface CodeEvm {
  codeId: string;
  code: string;
  name: string;
  category: CostCode["category"];
  extra: boolean;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cpi: number | null;
  spi: number | null;
  eac: number;
  /** Variance at completion: positive = under budget. */
  vac: number;
  pctComplete: number;
}

export interface JobEvm {
  jobId: string;
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cpi: number | null;
  spi: number | null;
  eac: number;
  vac: number;
  /** Margin the estimate promised: (contract - BAC) / contract. */
  budgetMargin: number;
  /** Margin the job is trending to: (contract - EAC) / contract. */
  marginAtCompletion: number;
  /** Forecast margin dollars at completion. */
  marginDollars: number;
  pctComplete: number;
  codes: CodeEvm[];
}

export interface EvmPoint {
  date: string;
  pv: number;
  ev: number;
  ac: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Share of a code's budget the schedule says should be earned by `date` (linear between planned start and end). */
export function plannedPercent(code: CostCode, date: string): number {
  if (date < code.plannedStart) return 0;
  const duration = daysBetween(code.plannedStart, code.plannedEnd) + 1;
  const elapsed = daysBetween(code.plannedStart, date) + 1;
  return clamp01(elapsed / duration);
}

function ratio(num: number, den: number): number | null {
  return den > 0 && num > 0 ? num / den : null;
}

function forecast(bac: number, ev: number, ac: number, cpi: number | null): number {
  if (cpi === null) return Math.max(bac, ac);
  return ac + (bac - ev) / cpi;
}

export function codeEvm(code: CostCode, days: CostDay[], asOf: string): CodeEvm {
  let ac = 0;
  let qty = 0;
  for (const d of days) {
    if (d.codeId !== code.id || d.date > asOf) continue;
    ac += d.cost;
    qty += d.qty;
  }
  const pctComplete = code.plannedQty > 0 ? clamp01(qty / code.plannedQty) : 0;
  const ev = code.budget * pctComplete;
  const pv = code.budget * plannedPercent(code, asOf);
  const cpi = ratio(ev, ac);
  const eac = forecast(code.budget, ev, ac, cpi);
  return {
    codeId: code.id,
    code: code.code,
    name: code.name,
    category: code.category,
    extra: !!code.extra,
    bac: code.budget,
    pv,
    ev,
    ac,
    cpi,
    spi: ratio(ev, pv),
    eac,
    vac: code.budget - eac,
    pctComplete,
  };
}

export function jobEvm(job: Job, codes: CostCode[], days: CostDay[], asOf: string): JobEvm {
  const jobCodes = codes.filter((c) => c.jobId === job.id);
  const jobDays = days.filter((d) => d.jobId === job.id);
  const rows = jobCodes.map((c) => codeEvm(c, jobDays, asOf));
  const bac = rows.reduce((a, r) => a + r.bac, 0);
  const pv = rows.reduce((a, r) => a + r.pv, 0);
  const ev = rows.reduce((a, r) => a + r.ev, 0);
  const ac = rows.reduce((a, r) => a + r.ac, 0);
  const cpi = ratio(ev, ac);
  const eac = forecast(bac, ev, ac, cpi);
  return {
    jobId: job.id,
    bac,
    pv,
    ev,
    ac,
    cpi,
    spi: ratio(ev, pv),
    eac,
    vac: bac - eac,
    budgetMargin: (job.contractValue - bac) / job.contractValue,
    marginAtCompletion: (job.contractValue - eac) / job.contractValue,
    marginDollars: job.contractValue - eac,
    pctComplete: bac > 0 ? ev / bac : 0,
    codes: rows,
  };
}

/** Cumulative PV / EV / AC for the job on each date, for the S-curve chart. */
export function evmSeries(job: Job, codes: CostCode[], days: CostDay[], dates: string[]): EvmPoint[] {
  const jobCodes = codes.filter((c) => c.jobId === job.id);
  const byCode = new Map<string, Map<string, CostDay>>();
  for (const d of days) {
    if (d.jobId !== job.id) continue;
    let m = byCode.get(d.codeId);
    if (!m) byCode.set(d.codeId, (m = new Map()));
    m.set(d.date, d);
  }
  const cumQty = new Map<string, number>();
  let ac = 0;
  const out: EvmPoint[] = [];
  for (const date of dates) {
    let pv = 0;
    let ev = 0;
    for (const c of jobCodes) {
      const row = byCode.get(c.id)?.get(date);
      if (row) {
        ac += row.cost;
        cumQty.set(c.id, (cumQty.get(c.id) ?? 0) + row.qty);
      }
      pv += c.budget * plannedPercent(c, date);
      if (c.plannedQty > 0) ev += c.budget * clamp01((cumQty.get(c.id) ?? 0) / c.plannedQty);
    }
    out.push({ date, pv, ev, ac });
  }
  return out;
}

/**
 * CPI over the trailing window only, so a job that went bad two weeks ago is not hidden by
 * a healthy first month. Null when nothing was spent or earned in the window.
 */
export function trailingCpi(job: Job, codes: CostCode[], days: CostDay[], asOf: string, window = 14): number | null {
  const now = jobEvm(job, codes, days, asOf);
  const then = jobEvm(job, codes, days, addDays(asOf, -window));
  return ratio(now.ev - then.ev, now.ac - then.ac);
}

/** Same as `trailingCpi`, for a single cost code. */
export function trailingCodeCpi(code: CostCode, days: CostDay[], asOf: string, window = 14): number | null {
  const now = codeEvm(code, days, asOf);
  const then = codeEvm(code, days, addDays(asOf, -window));
  return ratio(now.ev - then.ev, now.ac - then.ac);
}

/** Portfolio rollup across jobs, weighted by contract value. */
export function portfolioMargin(jobs: Job[], evms: JobEvm[]): { contractValue: number; eac: number; marginAtCompletion: number; marginDollars: number } {
  const contractValue = jobs.reduce((a, j) => a + j.contractValue, 0);
  const eac = evms.reduce((a, e) => a + e.eac, 0);
  return { contractValue, eac, marginAtCompletion: contractValue ? (contractValue - eac) / contractValue : 0, marginDollars: contractValue - eac };
}
