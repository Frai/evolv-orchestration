import { describe, expect, it } from "vitest";
import { durationMs, hours, int, longDate, money, moneyCompact, moneyExact, one, pct, shortDate, signedPct, signedPts } from "./format";

describe("money", () => {
  it("formats CAD with no cents", () => {
    expect(money(1234)).toBe("$1,234");
  });
  it("rounds down fractional cents display", () => {
    expect(money(1234.6)).toBe("$1,235");
  });
});

describe("moneyExact", () => {
  it("always shows two decimal places", () => {
    expect(moneyExact(5)).toBe("$5.00");
    expect(moneyExact(5.5)).toBe("$5.50");
  });
});

describe("moneyCompact", () => {
  it("compacts to k above 1000", () => {
    expect(moneyCompact(12345)).toBe("$12.3k");
  });
  it("stays full currency format below 1000", () => {
    expect(moneyCompact(500)).toBe("$500");
  });
  it("handles negative compacted values", () => {
    expect(moneyCompact(-2500)).toBe("$-2.5k");
  });
});

describe("int / one", () => {
  it("int rounds to a whole number", () => {
    expect(int(1234.7)).toBe("1,235");
  });
  it("one shows a single decimal", () => {
    expect(one(4)).toBe("4.0");
    expect(one(4.25)).toBe("4.3");
  });
});

describe("pct / signedPct / signedPts", () => {
  it("pct formats a ratio as a percentage", () => {
    expect(pct(0.284)).toBe("28.4%");
    expect(pct(0.284, 0)).toBe("28%");
  });
  it("signedPct adds a leading + for positive values", () => {
    expect(signedPct(0.05)).toBe("+5.0%");
    expect(signedPct(-0.05)).toBe("-5.0%");
    expect(signedPct(0)).toBe("0.0%");
  });
  it("signedPts formats as percentage points", () => {
    expect(signedPts(0.03)).toBe("+3.0 pts");
    expect(signedPts(-0.03)).toBe("-3.0 pts");
  });
});

describe("longDate / shortDate", () => {
  it("longDate spells out weekday and month", () => {
    expect(longDate("2026-01-01")).toBe("Thursday, January 1");
  });
  it("shortDate abbreviates month", () => {
    expect(shortDate("2026-01-01")).toBe("Jan 1");
  });
});

describe("durationMs", () => {
  it("shows ms under one second", () => {
    expect(durationMs(500)).toBe("500 ms");
  });
  it("shows seconds at or above one second", () => {
    expect(durationMs(1500)).toBe("1.5 s");
  });
});

describe("hours", () => {
  it("formats with one decimal and a unit suffix", () => {
    expect(hours(7.5)).toBe("7.5 h");
  });
});
