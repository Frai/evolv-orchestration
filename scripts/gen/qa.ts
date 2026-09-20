import type { LabourDay, Location, QAPair, SalesDay, StockLevel } from "@/core/types";
import { WEEKDAY_LONG, addDays, hourLabel, weekday } from "@/core/dates";
import { int, money, pct, signedPct } from "@/core/format";
import { deliveryShare, findDay, peakHour, sameWeekdayBaseline, type ItemTotal } from "@/core/sales";
import { labourPct } from "@/core/labour";
import { daysOfCover, reorderCost, reorderQty, sortByUrgency, stockStatus } from "@/core/inventory";
import { capacityFor, kitchenSeverity, peakKitchenLoad, peakWindowLabel } from "@/core/kitchen";
import { salesInWindow } from "./sales";

export interface QAContext {
  location: Location;
  asOf: string;
  salesDays: SalesDay[];
  labourDays: LabourDay[];
  stock: StockLevel[];
  deadItems: ItemTotal[];
  topItems: ItemTotal[];
  badSaturday: string;
  spike: string;
  outletTotals?: { name: string; netSales: number; delta: number | null }[];
}

export function generateQA(c: QAContext): QAPair[] {
  const { location, asOf, salesDays, labourDays, stock } = c;
  const yesterday = findDay(salesDays, asOf)!;
  const out: QAPair[] = [];

  // 1. Bad Saturday
  const sat = findDay(salesDays, c.badSaturday)!;
  const satBase = sameWeekdayBaseline(salesDays, c.badSaturday) ?? sat.netSales;
  const satDinner = salesInWindow(sat, [18, 22]);
  const satDinnerBase = (() => {
    const vals: number[] = [];
    for (let w = 1; w <= 4; w++) {
      const d = findDay(salesDays, addDays(c.badSaturday, -7 * w));
      if (d) vals.push(salesInWindow(d, [18, 22]));
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : satDinner;
  })();
  const satCoversBase = sameWeekdayBaseline(salesDays, c.badSaturday, 4, (d) => d.covers) ?? sat.covers;
  out.push({
    locationId: location.id,
    question: "Why were sales down on Saturday?",
    keywords: ["saturday", "down", "drop", "low", "soft", "why", "bad", "weak"],
    answer: `Saturday ${c.badSaturday} came in at ${money(sat.netSales)}, ${signedPct((sat.netSales - satBase) / satBase, 0)} against your four-week Saturday average of ${money(satBase)}. The gap opened in dinner service: 18:00–22:00 did ${money(satDinner)} against a usual ${money(satDinnerBase)}. Covers were ${int(sat.covers)} vs a typical ${int(satCoversBase)}, so it was fewer guests, not smaller checks. There is no weather, event or outage flag in the data. The most likely explanations are a competing event nearby or a block of cancelled reservations; the reservation log would settle it.`,
  });

  // 2. Best hour yesterday
  const peak = peakHour(yesterday);
  const second = [...yesterday.hourly.map((v, i) => ({ v, i }))].sort((a, b) => b.v - a.v)[1];
  out.push({
    locationId: location.id,
    question: "What was the best hour yesterday?",
    keywords: ["best", "hour", "peak", "busiest", "busy", "when"],
    answer: `${hourLabel(peak.index)}–${hourLabel(peak.index + 1)} was the peak at ${money(peak.value)}, ${pct(peak.value / yesterday.netSales, 0)} of the day. ${hourLabel(second.i)}–${hourLabel(second.i + 1)} was next at ${money(second.v)}. The two hours together carried ${pct((peak.value + second.v) / yesterday.netSales, 0)} of ${WEEKDAY_LONG[weekday(asOf)]}'s ${money(yesterday.netSales)}.`,
  });

  // 3. Labour this week
  const week = salesDays.slice(-7);
  const weekLabour = labourDays.slice(-7);
  const weekSales = week.reduce((a, d) => a + d.netSales, 0);
  const weekCost = weekLabour.reduce((a, d) => a + d.labourCost, 0);
  const worst = week
    .map((d) => ({ d, p: labourPct(weekLabour.find((l) => l.date === d.date), d) ?? 0 }))
    .sort((a, b) => b.p - a.p)[0];
  const best = week
    .map((d) => ({ d, p: labourPct(weekLabour.find((l) => l.date === d.date), d) ?? 0 }))
    .sort((a, b) => a.p - b.p)[0];
  out.push({
    locationId: location.id,
    question: "How is labour tracking this week?",
    keywords: ["labour", "labor", "staff", "staffing", "wages", "payroll", "hours", "schedule"],
    answer: `Over the last seven days labour was ${pct(weekCost / weekSales)} of sales (${money(weekCost)} on ${money(weekSales)}), against your ${pct(location.targetLabourPct, 0)} target. The worst day was ${WEEKDAY_LONG[weekday(worst.d.date)]} at ${pct(worst.p)}; the best was ${WEEKDAY_LONG[weekday(best.d.date)]} at ${pct(best.p)}. The Labour page lists the shifts driving the difference, and the Tuesday lunch proposal in Approvals is the quickest fix.`,
  });

  // 4. Reorder
  const urgent = sortByUrgency(stock).filter((s) => stockStatus(s) === "critical" || stockStatus(s) === "below_par");
  const lines = urgent.map((s) => `${s.name} (${s.onHand} ${s.unit} on hand, par ${s.par}, ${daysOfCover(s).toFixed(1)} days of cover)`);
  const totalCost = urgent.reduce((a, s) => a + reorderCost(s), 0);
  out.push({
    locationId: location.id,
    question: "What should I reorder?",
    keywords: ["reorder", "order", "stock", "inventory", "par", "running out", "supplier", "sysco"],
    answer: `${urgent.length} items are below par: ${lines.join("; ")}. ${urgent[0].name} is the urgent one. Bringing all ${urgent.length} back to par costs about ${money(totalCost)}; the first order (${reorderQty(urgent[0])} ${urgent[0].unit} of ${urgent[0].name} from ${urgent[0].supplier}, ${money(reorderCost(urgent[0]))}) is already drafted in Approvals.`,
  });

  // 5. Dead items
  const dead = c.deadItems;
  out.push({
    locationId: location.id,
    question: "Which menu items aren't selling?",
    keywords: ["items", "selling", "dead", "menu", "remove", "slow", "cut", "worst"],
    answer: `Three items have sold fewer than two a week over the last 30 days: ${dead.map((d) => `${d.name} (${int(d.qty)} sold, ${money(d.netSales)})`).join(", ")}. Together they made ${money(dead.reduce((a, d) => a + d.netSales, 0))} in 30 days. By comparison, ${c.topItems[0].name} sold ${int(c.topItems[0].qty)}. Removing the three would simplify prep without a measurable revenue hit; the proposal for ${dead[0].name} is in Approvals.`,
  });

  // 6. Channels / outlets
  if (location.type === "hotel" && c.outletTotals) {
    out.push({
      locationId: location.id,
      question: "How did each outlet do yesterday?",
      keywords: ["outlet", "outlets", "restaurant", "bar", "room service", "grange", "larkspur", "each"],
      answer: `${c.outletTotals.map((o) => `${o.name}: ${money(o.netSales)}${o.delta !== null ? ` (${signedPct(o.delta, 0)} vs a typical ${WEEKDAY_LONG[weekday(asOf)]})` : ""}`).join(". ")}. Total F&B was ${money(yesterday.netSales)}. Room service was ${pct(yesterday.channels.room_service / yesterday.netSales, 0)} of the total.`,
    });
  } else {
    const share = deliveryShare(yesterday);
    const shareBase = sameWeekdayBaseline(salesDays, asOf, 4, deliveryShare) ?? share;
    out.push({
      locationId: location.id,
      question: "How did delivery do yesterday?",
      keywords: ["delivery", "skip", "doordash", "uber", "takeout", "channel", "channels", "online"],
      answer: `Delivery was ${money(yesterday.channels.delivery)}, ${pct(share, 0)} of sales, against a usual ${pct(shareBase, 0)} on a ${WEEKDAY_LONG[weekday(asOf)]}. Takeout added ${money(yesterday.channels.takeout)} (${pct(yesterday.channels.takeout / yesterday.netSales, 0)}) and dine-in was ${money(yesterday.channels.dine_in)}. Delivery orders carry roughly a 25% platform commission, so ${money(yesterday.channels.delivery)} in delivery is worth about ${money(yesterday.channels.delivery * 0.75)} in the till.`,
    });
  }

  // 7. Kitchen load
  const capacity = capacityFor(location);
  const kPeak = peakKitchenLoad(yesterday, capacity);
  const kSeverity = kitchenSeverity(kPeak.ratio);
  const window = peakWindowLabel(kPeak.index);
  out.push({
    locationId: location.id,
    question: "Did the kitchen keep up yesterday?",
    keywords: ["kitchen", "keep up", "behind", "slammed", "slow", "tickets", "backed up", "crash", "overwhelmed"],
    answer: kSeverity
      ? `Not entirely. ${window} saw ${int(kPeak.orders)} tickets against a comfortable pace of about ${int(capacity)} an hour, ${pct(kPeak.ratio - 1, 0)} over. ${
          kSeverity === "critical"
            ? "That is enough to put the kitchen behind for the rest of the shift."
            : "That is close enough to normal that most tables probably didn't notice, but it's worth watching."
        } The Kitchen Pacing agent has a standing proposal in Approvals to spread that window out.`
      : `Yes. The busiest hour ran ${int(kPeak.orders)} tickets against a comfortable pace of about ${int(capacity)} an hour, ${pct(1 - kPeak.ratio, 0)} of headroom to spare.`,
  });

  return out;
}
