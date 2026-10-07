import type { Commitment, Equipment, SafetyEvent } from "../domain";
import { daysBetween } from "./dates";

/** Hours in a normal working day, the denominator for utilization. */
export const WORKDAY_HOURS = 10;

export function avgUtilization(eq: Equipment): number {
  if (!eq.usageHours14.length) return 0;
  const avg = eq.usageHours14.reduce((a, h) => a + h, 0) / eq.usageHours14.length;
  return Math.min(1, avg / WORKDAY_HOURS);
}

/** Days in the trailing window with under one hour of use. Weekends count: rented iron bills every day. */
export function idleDays(eq: Equipment, window = 7): number {
  return eq.usageHours14.slice(-window).filter((h) => h < 1).length;
}

/** Cost of the idle days in the window at the unit's daily rate. */
export function idleBurn(eq: Equipment, window = 7): number {
  return idleDays(eq, window) * eq.dailyRate;
}

export function serviceDueInDays(eq: Equipment, asOf: string): number | null {
  return eq.serviceDueDate ? daysBetween(asOf, eq.serviceDueDate) : null;
}

/** Days a commitment's promised date lands after the date the schedule needs it. Positive = late. */
export function materialSlipDays(c: Commitment): number {
  return daysBetween(c.needDate, c.promisedDate);
}

export function materialsAtRisk(commitments: Commitment[]): Commitment[] {
  return commitments.filter((c) => c.status === "open" && materialSlipDays(c) > 0).sort((a, b) => materialSlipDays(b) - materialSlipDays(a));
}

export function overdueSafety(events: SafetyEvent[], asOf: string): SafetyEvent[] {
  return events.filter((e) => e.status === "open" && e.correctiveDue < asOf).sort((a, b) => a.correctiveDue.localeCompare(b.correctiveDue));
}

export function daysOverdue(e: SafetyEvent, asOf: string): number {
  return daysBetween(e.correctiveDue, asOf);
}
