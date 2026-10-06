const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 });

export function money(v: number): string {
  return cad.format(v);
}
/** $14.2M, $480K, $9,400. */
export function moneyShort(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 1 : 2)}M`;
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}K`;
  return cad.format(v);
}
export function int(v: number): string {
  return num.format(v);
}
export function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}
/** Percentage-point magnitude: 0.009 -> "0.9 pts". */
export function pts(v: number, digits = 1): string {
  return `${(Math.abs(v) * 100).toFixed(digits)} pts`;
}
/** Lower-cases the first letter unless it starts an acronym ("VAV boxes" stays). */
export function lcFirst(s: string): string {
  if (s.length > 1 && s[1] === s[1].toUpperCase() && /[A-Z]/.test(s[1])) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
export function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}
export function signedPts(v: number, digits = 1): string {
  const s = (v * 100).toFixed(digits);
  return v > 0 ? `+${s} pts` : `${s} pts`;
}
export function signedMoneyShort(v: number): string {
  return v > 0 ? `+${moneyShort(v)}` : moneyShort(v);
}

function utc(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12));
}
export function longDate(d: string): string {
  return utc(d).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
export function shortDate(d: string): string {
  return utc(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
}
export function monthYear(d: string): string {
  return utc(d).toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
}
export function shortDateWeekday(d: string): string {
  return utc(d).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);
}
export function addDays(d: string, n: number): string {
  const t = utc(d);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export const BUSINESS_TZ = "America/Edmonton";
export function timeOfDay(iso: string, tz = BUSINESS_TZ): string {
  return new Date(iso)
    .toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", timeZone: tz })
    .replace(/\.\s?/g, "")
    .toUpperCase()
    .replace(/\s*(AM|PM)$/, " $1");
}
export function dateTime(iso: string, tz = BUSINESS_TZ): string {
  return `${new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: tz })}, ${timeOfDay(iso, tz)}`;
}
export function durationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
export function signedPct(v: number, digits = 1): string {
  const s = (v * 100).toFixed(digits);
  return v > 0 ? `+${s}%` : `${s}%`;
}
