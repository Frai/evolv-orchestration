import { CHANNELS, HOUR_COUNT, type Channel, type ItemSales, type MenuItem, type SalesDay } from "../domain";
import { addDays, isWithin, weekday } from "./dates";

export function sumBy<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((a, r) => a + f(r), 0);
}

/** Roll several outlet series (or a single series) into one row per date. */
export function aggregateSalesDays(rows: SalesDay[], locationId: string): SalesDay[] {
  const byDate = new Map<string, SalesDay>();
  for (const r of rows) {
    const cur = byDate.get(r.date);
    if (!cur) {
      byDate.set(r.date, {
        ...r,
        locationId,
        outletId: undefined,
        hourly: [...r.hourly],
        hourlyOrders: [...r.hourlyOrders],
        channels: { ...r.channels },
      });
      continue;
    }
    cur.netSales += r.netSales;
    cur.tax += r.tax;
    cur.tips += r.tips;
    cur.covers += r.covers;
    cur.orders += r.orders;
    cur.lastYearNetSales += r.lastYearNetSales;
    for (let i = 0; i < HOUR_COUNT; i++) {
      cur.hourly[i] += r.hourly[i];
      cur.hourlyOrders[i] += r.hourlyOrders[i];
    }
    for (const c of CHANNELS) cur.channels[c] += r.channels[c];
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateItemSales(rows: ItemSales[], locationId: string): ItemSales[] {
  const key = (r: ItemSales) => `${r.date}|${r.itemId}`;
  const map = new Map<string, ItemSales>();
  for (const r of rows) {
    const k = key(r);
    const cur = map.get(k);
    if (!cur) map.set(k, { ...r, locationId, outletId: undefined });
    else {
      cur.qty += r.qty;
      cur.netSales += r.netSales;
    }
  }
  return [...map.values()];
}

export function findDay(days: SalesDay[], date: string): SalesDay | undefined {
  return days.find((d) => d.date === date);
}

/** Average of the same weekday over the previous N weeks (excluding the date itself). */
export function sameWeekdayBaseline(days: SalesDay[], date: string, weeks = 4, pick: (d: SalesDay) => number = (d) => d.netSales): number | null {
  const vals: number[] = [];
  for (let w = 1; w <= weeks; w++) {
    const d = findDay(days, addDays(date, -7 * w));
    if (d) vals.push(pick(d));
  }
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function delta(current: number, baseline: number | null): number | null {
  if (baseline === null || baseline === 0) return null;
  return (current - baseline) / baseline;
}

export function deliveryShare(d: SalesDay): number {
  if (!d.netSales) return 0;
  return (d.channels.delivery + d.channels.room_service) / d.netSales;
}

export function channelShare(d: SalesDay, c: Channel): number {
  return d.netSales ? d.channels[c] / d.netSales : 0;
}

export function peakHour(d: SalesDay): { index: number; value: number } {
  let best = 0;
  for (let i = 1; i < d.hourly.length; i++) if (d.hourly[i] > d.hourly[best]) best = i;
  return { index: best, value: d.hourly[best] };
}

/** 7 x 13 grid of average hourly net sales, weekday-major (0 = Sunday). */
export function hourlyHeatmap(days: SalesDay[]): number[][] {
  const sums = Array.from({ length: 7 }, () => Array(HOUR_COUNT).fill(0) as number[]);
  const counts = Array(7).fill(0) as number[];
  for (const d of days) {
    const w = weekday(d.date);
    counts[w]++;
    for (let i = 0; i < HOUR_COUNT; i++) sums[w][i] += d.hourly[i];
  }
  return sums.map((row, w) => row.map((v) => (counts[w] ? v / counts[w] : 0)));
}

export interface ItemTotal extends MenuItem {
  qty: number;
  netSales: number;
  perWeek: number;
}

export function itemTotals(rows: ItemSales[], range: { from: string; to: string }, prices: Map<string, MenuItem>): ItemTotal[] {
  const map = new Map<string, ItemTotal>();
  const days = Math.max(1, Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86_400_000) + 1);
  for (const r of rows) {
    if (!isWithin(r.date, range)) continue;
    const cur = map.get(r.itemId);
    if (cur) {
      cur.qty += r.qty;
      cur.netSales += r.netSales;
    } else {
      const item = prices.get(r.itemId);
      map.set(r.itemId, {
        id: r.itemId,
        name: r.name,
        category: r.category,
        price: item?.price ?? (r.qty ? r.netSales / r.qty : 0),
        qty: r.qty,
        netSales: r.netSales,
        perWeek: 0,
      });
    }
  }
  // Make sure items with zero sales in the window still appear.
  for (const [id, item] of prices) if (!map.has(id)) map.set(id, { ...item, qty: 0, netSales: 0, perWeek: 0 });
  const out = [...map.values()];
  for (const t of out) t.perWeek = (t.qty / days) * 7;
  return out;
}

export function topItems(totals: ItemTotal[], n = 10): ItemTotal[] {
  return [...totals].sort((a, b) => b.netSales - a.netSales).slice(0, n);
}

export const DEAD_ITEM_PER_WEEK = 2;

export function deadItems(totals: ItemTotal[]): ItemTotal[] {
  return totals.filter((t) => t.perWeek < DEAD_ITEM_PER_WEEK).sort((a, b) => a.perWeek - b.perWeek);
}

export function inRange(days: SalesDay[], range: { from: string; to: string }): SalesDay[] {
  return days.filter((d) => isWithin(d.date, range));
}
