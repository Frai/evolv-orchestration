// Pure date helpers over YYYY-MM-DD strings. Local-time free: everything is UTC-noon anchored.

export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12));
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  const dt = parseDate(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISODate(dt);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(d: string): number {
  return parseDate(d).getUTCDay();
}

export const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayName(d: string): string {
  return WEEKDAY_LONG[weekday(d)];
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

export function rangeEndingAt(to: string, days: number) {
  return { from: addDays(to, -(days - 1)), to };
}

export function isWithin(d: string, range: { from: string; to: string }) {
  return d >= range.from && d <= range.to;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function hourLabel(index: number, start = 11): string {
  const h = start + index;
  return `${h.toString().padStart(2, "0")}:00`;
}
