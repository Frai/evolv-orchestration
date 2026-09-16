import type { LabourDay, Shift } from "@/core/types";
import { weekday } from "@/core/dates";
import { shiftHours } from "@/core/labour";
import { Rng, hashSeed } from "./rng";
import { LOCATIONS, type SeriesConfig, type ShiftTemplate } from "./world";
import { salesInWindow, weekdayFactor, type SeriesOutput } from "./sales";

export interface LabourPlants {
  overstaffedTuesdays: string[];
  understaffedFriday: string;
}

export function planLabour(dates: string[]): LabourPlants {
  const last = dates.length - 1;
  const tuesdays: string[] = [];
  for (let i = last; i >= 0 && tuesdays.length < 2; i--) if (weekday(dates[i]) === 2) tuesdays.push(dates[i]);
  let friday = dates[last];
  for (let i = last - 1; i >= 0; i--) {
    if (weekday(dates[i]) === 5) {
      friday = dates[i];
      break;
    }
  }
  return { overstaffedTuesdays: tuesdays, understaffedFriday: friday };
}

function rateFor(cfg: SeriesConfig, role: string): number {
  const loc = LOCATIONS.find((l) => l.id === cfg.locationId)!;
  return loc.wageBands.find((w) => w.role === role)?.hourlyRate ?? 17;
}

function heads(t: ShiftTemplate, sales: number, isWeekend: boolean): number {
  if (t.fixed !== undefined) return t.fixed + (isWeekend ? (t.weekendExtra ?? 0) : 0);
  return Math.max(t.min, Math.round(sales / t.dollarsPerHead)) + (isWeekend ? (t.weekendExtra ?? 0) : 0);
}

const round2 = (v: number) => Math.round(v * 100) / 100;
const BURDEN = 1.08; // CPP, EI, WCB

export function generateLabour(series: SeriesOutput, plants: LabourPlants): LabourDay[] {
  const { cfg, days, expected } = series;
  const rng = new Rng(hashSeed(`labour:${cfg.locationId}:${cfg.outletId ?? "all"}`));
  const out: LabourDay[] = [];

  days.forEach((day, i) => {
    const wd = weekday(day.date);
    const isWeekend = wd === 5 || wd === 6;
    // The schedule was written a week ahead against typical sales, not actuals.
    const expectedDay = { ...day, hourly: day.hourly.map((h) => (day.netSales ? (h / day.netSales) * expected[i] : 0)) };
    // Use the profile rather than the noisy hourly to size the schedule.
    const profileDay = { ...day, hourly: cfg.hourlyProfile.map((p) => p * expected[i]) };
    void expectedDay;

    const shifts: Shift[] = cfg.shifts.map((t) => {
      const plannedSales = salesInWindow(profileDay, t.window);
      const actualSales = salesInWindow(day, t.window);
      let scheduled = heads(t, plannedSales, isWeekend);
      let actual = scheduled;
      const needed = heads(t, actualSales, isWeekend);
      const rate = rateFor(cfg, t.role);

      // Planted: two overstaffed Tuesday lunches on the lunch FOH shift.
      const isLunchFoh = t.id === "lunch-foh" || t.id === "open-cashier";
      const isDinnerFoh = t.id === "dinner-foh" || t.id === "eve-cashier" || t.id === "night-bar";
      if (isLunchFoh && plants.overstaffedTuesdays.includes(day.date)) {
        scheduled = needed + 2;
        actual = scheduled;
      } else if (isDinnerFoh && day.date === plants.understaffedFriday) {
        actual = Math.max(1, scheduled - 2);
      } else if (t.fixed === undefined && rng.chance(0.06)) {
        actual = Math.max(t.min, scheduled - 1); // a call-out
      }

      // Only front-of-house shifts are flagged; kitchen staffing is sized by prep, not by covers.
      let flag: Shift["flag"];
      if (t.fixed === undefined && (isLunchFoh || isDinnerFoh || t.id === "day-bar" || t.id === "day-rs" || t.id === "night-rs")) {
        if (actual - needed >= 2) flag = "overstaffed";
        else if (needed - actual >= 2) flag = "understaffed";
      }

      return {
        id: `${day.date}:${t.id}`,
        role: t.role,
        start: t.start,
        end: t.end,
        scheduledStaff: scheduled,
        actualStaff: actual,
        neededStaff: needed,
        hourlyRate: rate,
        salesInWindow: round2(actualSales),
        flag,
      };
    });

    let scheduledHours = 0;
    let actualHours = 0;
    let cost = 0;
    for (const s of shifts) {
      const h = shiftHours(s);
      scheduledHours += s.scheduledStaff * h;
      const ah = s.actualStaff * h * rng.noise(0.03);
      actualHours += ah;
      cost += ah * s.hourlyRate * BURDEN;
    }

    out.push({
      locationId: cfg.locationId,
      outletId: cfg.outletId,
      date: day.date,
      scheduledHours: round2(scheduledHours),
      actualHours: round2(actualHours),
      labourCost: round2(cost),
      shifts,
    });
  });
  return out;
}

export { weekdayFactor };
