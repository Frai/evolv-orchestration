const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const cadCents = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });
const num1 = new Intl.NumberFormat("en-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function money(v: number): string {
  return cad.format(v);
}
export function moneyExact(v: number): string {
  return cadCents.format(v);
}
export function moneyCompact(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return cad.format(v);
}
export function int(v: number): string {
  return num.format(v);
}
export function one(v: number): string {
  return num1.format(v);
}
export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}
export function signedPct(v: number, digits = 1): string {
  const s = (v * 100).toFixed(digits);
  return v > 0 ? `+${s}%` : `${s}%`;
}
export function signedPts(v: number, digits = 1): string {
  const s = (v * 100).toFixed(digits);
  return v > 0 ? `+${s} pts` : `${s} pts`;
}
export function longDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function shortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}
export function shortDateWeekday(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
/** All tenants are in Alberta; times are shown in that zone regardless of the viewer's machine. */
export const BUSINESS_TZ = "America/Edmonton";

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TZ }).replace(/\.\s?/g, "").toUpperCase().replace(/(AM|PM)$/, " $1").replace("  ", " ");
}
export function dateTime(iso: string): string {
  return `${new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: BUSINESS_TZ })}, ${timeOfDay(iso)}`;
}
export function durationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
export function hours(h: number): string {
  return `${num1.format(h)} h`;
}
