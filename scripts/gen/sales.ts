import { CHANNELS, HOUR_COUNT, HOUR_START, type Channel, type SalesDay } from "@/core/types";
import { weekday } from "@/core/dates";
import { Rng, hashSeed } from "./rng";
import { SERIES, STANDARD_WEEKDAY, type SeriesConfig } from "./world";

export interface Anomalies {
  /** Date of the planted bad Saturday. */
  badSaturday: string;
  /** Date of the planted unexplained spike. */
  spike: string;
}

export interface ItemSeriesFixture {
  locationId: string;
  outletId?: string;
  itemId: string;
  qty: number[];
}

export interface SeriesOutput {
  cfg: SeriesConfig;
  days: SalesDay[];
  /** Expected (pre-noise, pre-anomaly) sales per day; used to build schedules. */
  expected: number[];
  items: ItemSeriesFixture[];
  anomalies: Anomalies;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function weekdayFactor(cfg: SeriesConfig, date: string): number {
  return (cfg.weekdayFactors ?? STANDARD_WEEKDAY)[weekday(date)];
}

/** Anomalies are planted per location so every outlet of a hotel shares the same story. */
export function planAnomalies(dates: string[]): Anomalies {
  const last = dates.length - 1;
  // Most recent Saturday at least 2 days back, so it sits inside the 7-day chart and the 14-day brief window.
  let badSaturday = dates[last];
  for (let i = last - 2; i >= 0; i--) {
    if (weekday(dates[i]) === 6) {
      badSaturday = dates[i];
      break;
    }
  }
  // A Sunday-to-Thursday day 2–6 days back that is not the bad Saturday.
  let spike = dates[last - 3];
  for (let i = last - 2; i >= last - 6; i--) {
    const w = weekday(dates[i]);
    if (w !== 5 && w !== 6 && dates[i] !== badSaturday) {
      spike = dates[i];
      break;
    }
  }
  return { badSaturday, spike };
}

function normalize(arr: number[], total: number): number[] {
  const s = arr.reduce((a, b) => a + b, 0) || 1;
  return arr.map((v) => round2((v / s) * total));
}

export function generateSeries(cfg: SeriesConfig, dates: string[], anomalies: Anomalies): SeriesOutput {
  const rng = new Rng(hashSeed(`sales:${cfg.locationId}:${cfg.outletId ?? "all"}`));
  const days: SalesDay[] = [];
  const expected: number[] = [];

  // Item popularity: Zipf-ish over a shuffled order; dead items get a tiny weight.
  const live = cfg.menu.filter((m) => !cfg.deadItemIds.includes(m.id));
  const order = rng.shuffle(live.map((m) => m.id));
  const weights = new Map<string, number>();
  const catBoost = (category: string) => {
    const c = category.toLowerCase();
    if (/drink|cocktail|beer|wine/.test(c)) return 1.25;
    if (/side|snack/.test(c)) return 1.3;
    if (/dessert/.test(c)) return 0.55;
    if (/main|dinner|taco|burger|all day|lunch/.test(c)) return 1.15;
    return 1;
  };
  order.forEach((id, i) => {
    const m = live.find((x) => x.id === id)!;
    weights.set(id, (catBoost(m.category) * 1) / Math.pow(i + 1, 0.6));
  });
  const weightSum = [...weights.values()].reduce((a, b) => a + b, 0);
  const items: ItemSeriesFixture[] = cfg.menu.map((m) => ({
    locationId: cfg.locationId,
    outletId: cfg.outletId,
    itemId: m.id,
    qty: [],
  }));

  dates.forEach((date, i) => {
    const trend = 1 + (i / dates.length) * 0.04;
    const exp = cfg.base * weekdayFactor(cfg, date) * trend;
    expected.push(exp);

    let factor = rng.noise(0.07);
    if (date === anomalies.badSaturday) factor = 0.58 * rng.noise(0.02);
    if (date === anomalies.spike) factor = 1.45 * rng.noise(0.02);

    const netSales = round2(exp * factor);
    const covers = Math.max(1, Math.round((netSales / cfg.avgCheck) * rng.noise(0.05)));
    const orders = Math.max(1, Math.round(covers / cfg.partySize));

    const hourly = normalize(
      cfg.hourlyProfile.map((p) => p * rng.noise(0.18)),
      netSales,
    );
    const mix = CHANNELS.map((c) => cfg.channelMix[c] * (cfg.channelMix[c] ? rng.noise(0.12) : 0));
    // Weekend dinners skew dine-in; wet Mondays skew delivery. Keep it subtle.
    const chanVals = normalize(mix, netSales);
    const channels = Object.fromEntries(CHANNELS.map((c, k) => [c, chanVals[k]])) as Record<Channel, number>;

    const lastYear = round2(exp * 0.93 * rng.noise(0.09));

    days.push({
      locationId: cfg.locationId,
      outletId: cfg.outletId,
      date,
      netSales,
      tax: round2(netSales * 0.05),
      tips: round2(netSales * cfg.tipRate * rng.noise(0.1)),
      covers,
      orders,
      hourly,
      channels,
      lastYearNetSales: lastYear,
    });

    // Item quantities for the day.
    const totalItems = covers * cfg.itemsPerCover * rng.noise(0.05);
    for (const it of items) {
      if (cfg.deadItemIds.includes(it.itemId)) {
        it.qty.push(rng.chance(0.11) ? 1 : 0);
      } else {
        const w = weights.get(it.itemId)! / weightSum;
        it.qty.push(Math.max(0, Math.round(totalItems * w * rng.noise(0.2))));
      }
    }
  });

  return { cfg, days, expected, items, anomalies };
}

export function generateAllSales(dates: string[]) {
  const anomalies = planAnomalies(dates);
  return SERIES.map((cfg) => generateSeries(cfg, dates, anomalies));
}

/** Sales inside a 24h-clock window, from the hourly buckets. */
export function salesInWindow(day: SalesDay, window: [number, number]): number {
  let s = 0;
  for (let i = 0; i < HOUR_COUNT; i++) {
    const h = HOUR_START + i;
    if (h >= window[0] && h < window[1]) s += day.hourly[i];
  }
  return s;
}
