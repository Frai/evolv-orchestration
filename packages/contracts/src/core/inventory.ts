import type { StockLevel, StockStatus } from "../domain";

export function daysOfCover(s: StockLevel): number {
  if (!s.dailyUsage) return Infinity;
  return s.onHand / s.dailyUsage;
}

export function stockStatus(s: StockLevel): StockStatus {
  const ratio = s.par ? s.onHand / s.par : 1;
  if (ratio < 0.25) return "critical";
  if (ratio < 1) return "below_par";
  if (ratio < 1.25) return "low";
  return "ok";
}

export const STATUS_ORDER: Record<StockStatus, number> = { critical: 0, below_par: 1, low: 2, ok: 3 };

export function sortByUrgency(rows: StockLevel[]): StockLevel[] {
  return [...rows].sort((a, b) => {
    const d = STATUS_ORDER[stockStatus(a)] - STATUS_ORDER[stockStatus(b)];
    if (d !== 0) return d;
    return daysOfCover(a) - daysOfCover(b);
  });
}

/** Standard reorder is one par's worth, rounded up to the item's typical pack size. */
export function reorderQty(s: StockLevel): number {
  const pack = s.par >= 200 ? 50 : s.par >= 40 ? 10 : s.par >= 10 ? 5 : 1;
  return Math.max(pack, Math.ceil(s.par / pack) * pack);
}

export function reorderCost(s: StockLevel): number {
  return Math.round(reorderQty(s) * s.unitCost * 100) / 100;
}
