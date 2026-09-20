import type { Brief, LabourDay, Location, SalesDay, StockLevel } from "@evolv/contracts/types";
import type { BriefInput } from "@evolv/contracts/brief";
import { WEEKDAY_LONG, addDays, hourLabel, weekday } from "@evolv/contracts/dates";
import { int, money, pct, signedPct, signedPts } from "@evolv/contracts/format";
import { flaggedShifts } from "@evolv/contracts/labour";
import { sameWeekdayBaseline } from "@evolv/contracts/sales";
import { stockStatus } from "@evolv/contracts/inventory";
import { peakWindowLabel } from "@evolv/contracts/kitchen";
import type { ItemTotal } from "@evolv/contracts/sales";

export interface BriefContext {
  location: Location;
  input: BriefInput;
  salesDays: SalesDay[];
  labourDay?: LabourDay;
  /** Same-day totals per outlet for hotels. */
  outletTotals?: { name: string; netSales: number; delta: number | null }[];
  topItem?: ItemTotal;
  deadItems: ItemTotal[];
  /** Only for the most recent day. */
  stock?: StockLevel[];
  /** Day index in the 14-day window, used to rotate wording. */
  variant: number;
  isLatest: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function salesParagraph(c: BriefContext): string {
  const { input: i, variant } = c;
  const wd = i.weekdayName;
  const d = i.netSalesDelta ?? 0;
  const base = money(i.netSalesBaseline ?? i.netSales);
  const coversDelta = i.coversDelta !== null ? ` (${signedPct(i.coversDelta, 0)})` : "";
  const yoy = i.yoyDelta !== null ? ` Against the same ${wd} last year you were ${signedPct(i.yoyDelta, 0)}.` : "";

  if (d <= -0.15) {
    return variant % 2 === 0
      ? `${wd} came in soft. Net sales were ${money(i.netSales)} against a four-week ${wd} average of ${base}, ${signedPct(d, 0)}. Covers were ${int(i.covers)}${coversDelta}, so this was fewer guests rather than smaller checks: average check held at ${money(i.avgCheck)}.${yoy}`
      : `A weak ${wd}: ${money(i.netSales)} in net sales, ${signedPct(d, 0)} against the ${base} you usually do. ${int(i.covers)} covers${coversDelta} at a ${money(i.avgCheck)} average check. The gap is in guest count, not spend.${yoy}`;
  }
  if (d >= 0.25) {
    return variant % 2 === 0
      ? `${wd} was unusually strong: ${money(i.netSales)} in net sales, ${signedPct(d, 0)} above a typical ${wd} (${base}). ${int(i.covers)} covers${coversDelta} at a ${money(i.avgCheck)} average check. Nothing on the reservation book or the events calendar explains it, so it is worth asking the floor team what they saw.${yoy}`
      : `Big ${wd}. ${money(i.netSales)} net, ${signedPct(d, 0)} over the four-week ${wd} average of ${base}, on ${int(i.covers)} covers${coversDelta}. There is no booking, event or promotion in the data that accounts for it; treat it as a one-off until it repeats.${yoy}`;
  }
  if (d >= 0.05) {
    return variant % 2 === 0
      ? `Solid ${wd}. Net sales were ${money(i.netSales)}, ${signedPct(d, 0)} against the four-week ${wd} average of ${base}, on ${int(i.covers)} covers${coversDelta}. Average check was ${money(i.avgCheck)}.${yoy}`
      : `${wd} finished ahead: ${money(i.netSales)} net sales, ${signedPct(d, 0)} vs a typical ${wd}. ${int(i.covers)} covers${coversDelta}, ${money(i.avgCheck)} average check.${yoy}`;
  }
  if (d <= -0.05) {
    return variant % 2 === 0
      ? `${wd} ran a little behind: ${money(i.netSales)} in net sales, ${signedPct(d, 0)} against the four-week ${wd} average of ${base}. Covers were ${int(i.covers)}${coversDelta} and the average check was ${money(i.avgCheck)}.${yoy}`
      : `A slightly quiet ${wd}. ${money(i.netSales)} net, ${signedPct(d, 0)} vs the ${base} you usually do on a ${wd}, with ${int(i.covers)} covers${coversDelta}.${yoy}`;
  }
  return variant % 2 === 0
    ? `A typical ${wd}: ${money(i.netSales)} in net sales, within ${pct(Math.abs(d), 0)} of the four-week average. ${int(i.covers)} covers${coversDelta}, average check ${money(i.avgCheck)}.${yoy}`
    : `${wd} landed where it usually does. ${money(i.netSales)} net sales against a ${base} average, ${int(i.covers)} covers${coversDelta}, ${money(i.avgCheck)} per guest.${yoy}`;
}

function shapeParagraph(c: BriefContext): string {
  const { input: i, location } = c;
  const peak = hourLabel(i.peakHourIndex);
  const peakEnd = hourLabel(i.peakHourIndex + 1);
  const dinner = i.channels;
  const parts: string[] = [];
  parts.push(`The busiest hour was ${peak}–${peakEnd} at ${money(i.peakHourSales)}.`);

  if (location.type === "hotel" && c.outletTotals) {
    const o = c.outletTotals;
    const bits = o.map((x) => `${x.name} ${money(x.netSales)}${x.delta !== null ? ` (${signedPct(x.delta, 0)})` : ""}`);
    parts.push(`By outlet: ${bits.join(", ")}.`);
    const rs = dinner.room_service;
    if (rs) parts.push(`Room service was ${pct(rs / i.netSales, 0)} of F&B revenue.`);
  } else {
    const share = i.deliveryShare;
    if (share > 0.02) {
      const dp = i.deliveryShareDelta !== null ? ` (${signedPts(i.deliveryShareDelta)} vs usual)` : "";
      parts.push(`Delivery was ${pct(share, 0)} of sales${dp}, takeout ${pct(dinner.takeout / i.netSales, 0)}.`);
    } else {
      parts.push(`Dine-in was ${pct(dinner.dine_in / i.netSales, 0)} of sales, takeout ${pct(dinner.takeout / i.netSales, 0)}.`);
    }
  }
  return parts.join(" ");
}

function kitchenParagraph(c: BriefContext): string | null {
  const { input: i } = c;
  if (!i.kitchenSeverity) return null;
  const window = peakWindowLabel(i.kitchenPeakHourIndex);
  const verb = i.kitchenSeverity === "critical" ? "very likely fell behind" : "ran hot";
  const day = c.salesDays.find((d) => d.date === i.date);
  const ticketShare = i.orders ? i.kitchenPeakOrders / i.orders : 0;
  const salesShare = day && i.netSales ? day.hourly[i.kitchenPeakHourIndex] / i.netSales : ticketShare;
  const bunched = ticketShare > salesShare * 1.3;
  const tail = bunched
    ? "That did not show up as a sales spike — it was orders landing on top of each other rather than a busier day."
    : "It was a genuinely busy hour, not just a cluster of orders.";
  return `The kitchen ${verb} ${window}: ${int(i.kitchenPeakOrders)} tickets against a comfortable pace of about ${int(i.kitchenCapacity)} an hour. ${tail}`;
}

function labourParagraph(c: BriefContext): string {
  const { input: i, labourDay, location } = c;
  if (i.labourPct === null || !labourDay) return "Labour data for the day had not synced when this brief was written.";
  const target = pct(location.targetLabourPct, 0);
  const lp = pct(i.labourPct);
  const over = flaggedShifts([labourDay], "overstaffed");
  const under = flaggedShifts([labourDay], "understaffed");
  const parts: string[] = [];
  if (i.labourPct >= location.targetLabourPct + 0.03) {
    parts.push(`Labour landed at ${lp} of sales against a ${target} target, ${money(labourDay.labourCost)} in wages.`);
  } else if (i.labourPct <= location.targetLabourPct - 0.03) {
    parts.push(`Labour was ${lp} of sales, comfortably under the ${target} target at ${money(labourDay.labourCost)}.`);
  } else {
    parts.push(`Labour came in at ${lp} of sales, on target (${target}), ${money(labourDay.labourCost)} in wages.`);
  }
  if (i.labourPctDelta !== null && Math.abs(i.labourPctDelta) >= 0.02) parts.push(`That is ${signedPts(i.labourPctDelta)} vs the last four ${i.weekdayName}s.`);
  for (const o of over) {
    parts.push(
      `The ${o.shift.start}–${o.shift.end} ${o.shift.role.toLowerCase()} shift had ${o.shift.actualStaff} on for ${money(o.shift.salesInWindow)} in sales; ${o.shift.neededStaff} would have covered it. That is about ${money(o.costImpact)} you did not need to spend.`,
    );
  }
  for (const u of under) {
    parts.push(
      `The ${u.shift.start}–${u.shift.end} ${u.shift.role.toLowerCase()} shift ran short: ${u.shift.actualStaff} worked against ${u.shift.scheduledStaff} scheduled, through a ${money(u.shift.salesInWindow)} window. Expect it to show up in reviews.`,
    );
  }
  return parts.join(" ");
}

function menuParagraph(c: BriefContext): string {
  const parts: string[] = [];
  if (c.topItem) parts.push(`${c.topItem.name} led the menu with ${int(c.topItem.qty)} sold (${money(c.topItem.netSales)}).`);
  if (c.deadItems.length) {
    const d = c.deadItems[0];
    parts.push(`${d.name} has sold ${int(d.qty)} in the last 30 days; worth deciding whether it stays.`);
  }
  if (c.stock) {
    const critical = c.stock.filter((s) => stockStatus(s) === "critical");
    const below = c.stock.filter((s) => stockStatus(s) === "below_par");
    if (critical.length) {
      const s = critical[0];
      parts.push(`${s.name} is at ${s.onHand} ${s.unit} against a par of ${s.par}, under a day of cover. A reorder is waiting in Approvals.`);
    } else if (below.length) {
      parts.push(`${below.length} stock items are below par: ${below.map((b) => b.name).join(", ")}.`);
    } else {
      parts.push("Everything tracked in stock is at or above par.");
    }
  }
  return parts.join(" ");
}

function lookAheadParagraph(c: BriefContext): string {
  const { input: i, salesDays } = c;
  const next = addDays(i.date, 1);
  const nextName = WEEKDAY_LONG[weekday(next)];
  const base = sameWeekdayBaseline(salesDays, next, 4) ?? sameWeekdayBaseline(salesDays, addDays(next, -7), 4);
  const typical = base ? `a typical ${nextName} does ${money(base)}` : `no ${nextName} baseline yet`;
  const wd = weekday(next);
  const hint = wd === 5 || wd === 6 ? "Make sure the dinner section is fully staffed." : wd === 1 || wd === 2 ? "Keep the lunch floor light." : "Nothing unusual on the calendar.";
  return `Today is ${nextName}; ${typical}. ${hint}`;
}

function headline(c: BriefContext): string {
  const { input: i } = c;
  const d = i.netSalesDelta;
  const wd = i.weekdayName;
  if (d === null) return `${wd}: ${money(i.netSales)}`;
  if (d <= -0.15) return `Soft ${wd}: ${money(i.netSales)}, ${signedPct(d, 0)} vs typical`;
  if (d >= 0.25) return `Strong ${wd}: ${money(i.netSales)}, ${signedPct(d, 0)} vs typical`;
  if (Math.abs(d) < 0.05) return `Steady ${wd}: ${money(i.netSales)}, on trend`;
  return `${cap(wd)}: ${money(i.netSales)}, ${signedPct(d, 0)} vs typical`;
}

export function composeBrief(c: BriefContext, channel: Brief["channel"], deliveredAt: string): Brief {
  const paragraphs = [salesParagraph(c), shapeParagraph(c), kitchenParagraph(c), labourParagraph(c), menuParagraph(c)];
  if (c.isLatest || c.variant % 3 === 0) paragraphs.push(lookAheadParagraph(c));
  return {
    locationId: c.location.id,
    date: c.input.date,
    headline: headline(c),
    paragraphs: paragraphs.filter((p): p is string => Boolean(p)),
    deliveredAt,
    channel,
  };
}
