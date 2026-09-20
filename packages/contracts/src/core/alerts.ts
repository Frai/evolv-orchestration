import type { Alert, ItemSales, LabourDay, Location, MenuItem, SalesDay, StockLevel } from "../domain";
import { addDays, WEEKDAY_LONG, weekday } from "./dates";
import { deadItems, delta, findDay, itemTotals, sameWeekdayBaseline } from "./sales";
import { flaggedShifts, labourPct } from "./labour";
import { stockStatus } from "./inventory";
import { capacityFor, kitchenSeverity, peakKitchenLoad, peakWindowLabel } from "./kitchen";
import { int, money, pct, signedPct } from "./format";

export interface AlertInput {
  location: Location;
  date: string;
  salesDays: SalesDay[];
  labourDays: LabourDay[];
  stock: StockLevel[];
  itemSales: ItemSales[];
  menu: MenuItem[];
}

export const RULES = {
  salesDropPct: -0.15,
  salesSpikePct: 0.25,
  labourOverTargetPts: 0.03,
  deadItemWindowDays: 30,
};

/**
 * Rules over canonical data. Runs at request time so the rules are real even when the data is mocked.
 */
export function detectAlerts(input: AlertInput): Alert[] {
  const { location, date, salesDays, labourDays, stock, itemSales, menu } = input;
  const alerts: Alert[] = [];
  const wd = WEEKDAY_LONG[weekday(date)];
  const push = (a: Omit<Alert, "id" | "locationId" | "date">) =>
    alerts.push({ id: `${location.id}:${date}:${alerts.length + 1}`, locationId: location.id, date, ...a });

  const day = findDay(salesDays, date);
  if (day) {
    const base = sameWeekdayBaseline(salesDays, date);
    const d = delta(day.netSales, base);
    if (d !== null && d <= RULES.salesDropPct) {
      push({
        severity: "warning",
        source: "sales",
        href: "/sales/",
        title: `Net sales ${signedPct(d)} vs a typical ${wd}`,
        detail: `${money(day.netSales)} against a four-week ${wd} average of ${money(base ?? 0)}.`,
      });
    } else if (d !== null && d >= RULES.salesSpikePct) {
      push({
        severity: "info",
        source: "sales",
        href: "/sales/",
        title: `Unusual spike: ${signedPct(d)} vs a typical ${wd}`,
        detail: `${money(day.netSales)} against a four-week ${wd} average of ${money(base ?? 0)}. No event on the calendar explains it.`,
      });
    }
  }

  if (day) {
    const capacity = capacityFor(location);
    const peak = peakKitchenLoad(day, capacity);
    const severity = kitchenSeverity(peak.ratio);
    if (severity) {
      const ticketShare = day.orders ? peak.orders / day.orders : 0;
      const salesShare = day.netSales ? day.hourly[peak.index] / day.netSales : 0;
      const bunched = ticketShare > salesShare * 1.3;
      push({
        severity,
        source: "kitchen",
        href: "/sales/#kitchen-load",
        title: severity === "critical" ? `Kitchen likely fell behind ${peakWindowLabel(peak.index)}` : `Kitchen ran hot ${peakWindowLabel(peak.index)}`,
        detail: bunched
          ? `${int(peak.orders)} tickets against a comfortable pace of about ${int(capacity)}/hour. Net sales that hour did not look unusual — this was orders bunching up, not a sales spike.`
          : `${int(peak.orders)} tickets against a comfortable pace of about ${int(capacity)}/hour, driven by a genuinely busy hour rather than a one-off cluster of orders.`,
      });
    }
  }

  const labour = labourDays.find((l) => l.date === date);
  const lp = labourPct(labour, day);
  if (lp !== null && lp >= location.targetLabourPct + RULES.labourOverTargetPts) {
    push({
      severity: lp >= location.targetLabourPct + 0.08 ? "critical" : "warning",
      source: "labour",
      href: "/labour/",
      title: `Labour at ${pct(lp)} of sales, target ${pct(location.targetLabourPct, 0)}`,
      detail: `${money(labour?.labourCost ?? 0)} labour on ${money(day?.netSales ?? 0)} net sales.`,
    });
  }

  const over = flaggedShifts(labourDays.filter((l) => l.date === date), "overstaffed");
  for (const o of over) {
    push({
      severity: "info",
      source: "labour",
      href: "/labour/",
      title: `Overstaffed ${o.shift.role} shift ${o.shift.start}–${o.shift.end}`,
      detail: `${o.shift.actualStaff} on the floor, ${o.shift.neededStaff} needed for ${money(o.shift.salesInWindow)} in sales. About ${money(o.costImpact)} in avoidable labour.`,
    });
  }
  const under = flaggedShifts(labourDays.filter((l) => l.date === date), "understaffed");
  for (const u of under) {
    push({
      severity: "warning",
      source: "labour",
      href: "/labour/",
      title: `Understaffed ${u.shift.role} shift ${u.shift.start}–${u.shift.end}`,
      detail: `${u.shift.actualStaff} worked against ${u.shift.scheduledStaff} scheduled during a ${money(u.shift.salesInWindow)} window.`,
    });
  }

  const critical = stock.filter((s) => stockStatus(s) === "critical");
  const belowPar = stock.filter((s) => stockStatus(s) === "below_par");
  if (critical.length) {
    push({
      severity: "critical",
      source: "inventory",
      href: "/inventory/",
      title: `${critical.map((c) => c.name).join(", ")} critically low`,
      detail: `${critical[0].onHand} ${critical[0].unit} on hand against a par of ${critical[0].par}. Less than a day of cover.`,
    });
  }
  if (belowPar.length) {
    push({
      severity: "warning",
      source: "inventory",
      href: "/inventory/",
      title: `${belowPar.length} item${belowPar.length === 1 ? "" : "s"} below par`,
      detail: belowPar.map((b) => b.name).join(", ") + ".",
    });
  }

  const range = { from: addDays(date, -(RULES.deadItemWindowDays - 1)), to: date };
  const dead = deadItems(itemTotals(itemSales, range, new Map(menu.map((m) => [m.id, m]))));
  if (dead.length) {
    push({
      severity: "info",
      source: "sales",
      href: "/sales/",
      title: `${dead.length} menu item${dead.length === 1 ? "" : "s"} selling under 2 a week`,
      detail: dead.map((d) => `${d.name} (${d.qty} in 30 days)`).join(", ") + ".",
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
