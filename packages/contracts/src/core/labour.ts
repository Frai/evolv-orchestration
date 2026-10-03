import type { CostDay, DateRange } from "../domain";
import { addDays, isWithin, weekday } from "./dates";

export interface WeekHours {
  /** Monday of the week, YYYY-MM-DD */
  weekStart: string;
  regular: number;
  overtime: number;
  cost: number;
}

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7));
}

export function hoursInRange(days: CostDay[], range: DateRange): { total: number; overtime: number } {
  let total = 0;
  let overtime = 0;
  for (const d of days) {
    if (!d.hours || !isWithin(d.date, range)) continue;
    total += d.hours;
    overtime += d.overtimeHours;
  }
  return { total, overtime };
}

/** Overtime as a share of labour hours; null when no labour hours were booked. */
export function overtimePct(days: CostDay[], range: DateRange): number | null {
  const { total, overtime } = hoursInRange(days, range);
  return total > 0 ? overtime / total : null;
}

/** Weekly labour hours split into regular and overtime, oldest week first. */
export function weeklyHours(days: CostDay[], range: DateRange): WeekHours[] {
  const weeks = new Map<string, WeekHours>();
  for (const d of days) {
    if (!d.hours || !isWithin(d.date, range)) continue;
    const key = weekStart(d.date);
    let w = weeks.get(key);
    if (!w) weeks.set(key, (w = { weekStart: key, regular: 0, overtime: 0, cost: 0 }));
    w.regular += d.hours - d.overtimeHours;
    w.overtime += d.overtimeHours;
    w.cost += d.cost;
  }
  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export interface CodeHours {
  codeId: string;
  hours: number;
  overtime: number;
  overtimePct: number;
}

/** Labour hours per cost code over a range, heaviest overtime share first. */
export function hoursByCode(days: CostDay[], range: DateRange): CodeHours[] {
  const m = new Map<string, { hours: number; overtime: number }>();
  for (const d of days) {
    if (!d.hours || !isWithin(d.date, range)) continue;
    const cur = m.get(d.codeId) ?? { hours: 0, overtime: 0 };
    cur.hours += d.hours;
    cur.overtime += d.overtimeHours;
    m.set(d.codeId, cur);
  }
  return [...m.entries()]
    .map(([codeId, v]) => ({ codeId, hours: v.hours, overtime: v.overtime, overtimePct: v.hours ? v.overtime / v.hours : 0 }))
    .sort((a, b) => b.overtimePct - a.overtimePct);
}
