import type { LabourDay, Location, SalesDay } from "./types";
import { WEEKDAY_LONG, weekday } from "./dates";
import { deliveryShare, delta, findDay, peakHour, sameWeekdayBaseline } from "./sales";
import { labourPct, labourPctBaseline } from "./labour";

export interface BriefInput {
  locationId: string;
  date: string;
  weekdayName: string;
  netSales: number;
  netSalesBaseline: number | null;
  netSalesDelta: number | null;
  lastYearNetSales: number;
  yoyDelta: number | null;
  covers: number;
  coversBaseline: number | null;
  coversDelta: number | null;
  orders: number;
  avgCheck: number;
  labourPct: number | null;
  labourPctBaseline: number | null;
  labourPctDelta: number | null;
  targetLabourPct: number;
  deliveryShare: number;
  deliveryShareBaseline: number | null;
  deliveryShareDelta: number | null;
  peakHourIndex: number;
  peakHourSales: number;
  channels: SalesDay["channels"];
}

/**
 * Computes everything a narrator needs to write the day's brief.
 * Deltas are against the same weekday over the previous four weeks.
 */
export function buildBriefInput(location: Location, date: string, salesDays: SalesDay[], labourDays: LabourDay[]): BriefInput | null {
  const day = findDay(salesDays, date);
  if (!day) return null;
  const labour = labourDays.find((l) => l.date === date);

  const netSalesBaseline = sameWeekdayBaseline(salesDays, date);
  const coversBaseline = sameWeekdayBaseline(salesDays, date, 4, (d) => d.covers);
  const shareBaseline = sameWeekdayBaseline(salesDays, date, 4, deliveryShare);
  const lp = labourPct(labour, day);
  const lpBase = labourPctBaseline(labourDays, salesDays, date);
  const peak = peakHour(day);
  const share = deliveryShare(day);

  return {
    locationId: location.id,
    date,
    weekdayName: WEEKDAY_LONG[weekday(date)],
    netSales: day.netSales,
    netSalesBaseline,
    netSalesDelta: delta(day.netSales, netSalesBaseline),
    lastYearNetSales: day.lastYearNetSales,
    yoyDelta: delta(day.netSales, day.lastYearNetSales),
    covers: day.covers,
    coversBaseline,
    coversDelta: delta(day.covers, coversBaseline),
    orders: day.orders,
    avgCheck: day.covers ? day.netSales / day.covers : 0,
    labourPct: lp,
    labourPctBaseline: lpBase,
    labourPctDelta: lp !== null && lpBase !== null ? lp - lpBase : null,
    targetLabourPct: location.targetLabourPct,
    deliveryShare: share,
    deliveryShareBaseline: shareBaseline,
    deliveryShareDelta: shareBaseline !== null ? share - shareBaseline : null,
    peakHourIndex: peak.index,
    peakHourSales: peak.value,
    channels: day.channels,
  };
}
