import type { Location, SalesDay } from "../domain";
import { hourLabel } from "./dates";

/**
 * Kitchen load: tickets arriving per hour against the kitchen's sustainable pace.
 * This is the "will the kitchen fall behind" signal, distinct from net sales — a burst
 * of small, simultaneous orders can overload a kitchen without net sales looking unusual.
 */

/** Ratio of tickets to capacity for each hour. 1.0 = running exactly at pace. */
export function hourlyLoad(day: SalesDay, capacityPerHour: number): number[] {
  if (!capacityPerHour) return day.hourlyOrders.map(() => 0);
  return day.hourlyOrders.map((o) => o / capacityPerHour);
}

export interface KitchenPeak {
  index: number;
  orders: number;
  ratio: number;
}

/** The hour that ran closest to (or past) capacity. */
export function peakKitchenLoad(day: SalesDay, capacityPerHour: number): KitchenPeak {
  const load = hourlyLoad(day, capacityPerHour);
  let best = 0;
  for (let i = 1; i < load.length; i++) if (load[i] > load[best]) best = i;
  return { index: best, orders: day.hourlyOrders[best], ratio: load[best] };
}

export const KITCHEN_RULES = {
  /** Ratio at/above which the kitchen is at risk of falling behind. */
  warningRatio: 1.3,
  /** Ratio at/above which service is very likely to slip. */
  criticalRatio: 1.6,
};

export function kitchenSeverity(ratio: number): "critical" | "warning" | null {
  if (ratio >= KITCHEN_RULES.criticalRatio) return "critical";
  if (ratio >= KITCHEN_RULES.warningRatio) return "warning";
  return null;
}

/** Resolves the right capacity for a location/outlet combination. Hotels sum their outlets when no outlet is selected. */
export function capacityFor(location: Location, outletId?: string): number {
  if (outletId && location.outlets) {
    return location.outlets.find((o) => o.id === outletId)?.kitchenTicketCapacityPerHour ?? location.kitchenTicketCapacityPerHour;
  }
  return location.kitchenTicketCapacityPerHour;
}

export function peakWindowLabel(index: number): string {
  return `${hourLabel(index)}–${hourLabel(index + 1)}`;
}
