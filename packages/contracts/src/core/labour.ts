import type { LabourDay, SalesDay, Shift } from "../domain";
import { addDays } from "./dates";
import { findDay } from "./sales";

export function aggregateLabourDays(rows: LabourDay[], locationId: string): LabourDay[] {
  const byDate = new Map<string, LabourDay>();
  for (const r of rows) {
    const cur = byDate.get(r.date);
    if (!cur) {
      byDate.set(r.date, { ...r, locationId, outletId: undefined, shifts: r.shifts.map((s) => ({ ...s, id: r.outletId ? `${r.outletId}:${s.id}` : s.id })) });
      continue;
    }
    cur.scheduledHours += r.scheduledHours;
    cur.actualHours += r.actualHours;
    cur.labourCost += r.labourCost;
    cur.shifts = cur.shifts.concat(r.shifts.map((s) => ({ ...s, id: r.outletId ? `${r.outletId}:${s.id}` : s.id })));
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function labourPct(labour: LabourDay | undefined, sales: SalesDay | undefined): number | null {
  if (!labour || !sales || !sales.netSales) return null;
  return labour.labourCost / sales.netSales;
}

export function labourPctBaseline(labourDays: LabourDay[], salesDays: SalesDay[], date: string, weeks = 4): number | null {
  const vals: number[] = [];
  for (let w = 1; w <= weeks; w++) {
    const d = addDays(date, -7 * w);
    const p = labourPct(labourDays.find((l) => l.date === d), findDay(salesDays, d));
    if (p !== null) vals.push(p);
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export interface FlaggedShift {
  date: string;
  shift: Shift;
  excessStaff: number;
  /** Positive = money that could be saved (overstaffed). */
  costImpact: number;
  hoursInWindow: number;
}

export function shiftHours(s: Shift): number {
  const [sh, sm] = s.start.split(":").map(Number);
  const [eh, em] = s.end.split(":").map(Number);
  return eh + em / 60 - (sh + sm / 60);
}

export function flaggedShifts(days: LabourDay[], flag: "overstaffed" | "understaffed"): FlaggedShift[] {
  const out: FlaggedShift[] = [];
  for (const d of days) {
    for (const s of d.shifts) {
      if (s.flag !== flag) continue;
      const excess = s.actualStaff - s.neededStaff;
      const h = shiftHours(s);
      out.push({ date: d.date, shift: s, excessStaff: excess, costImpact: excess * h * s.hourlyRate, hoursInWindow: h });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
