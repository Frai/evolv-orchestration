import { describe, expect, it } from "vitest";
import { addDays, daysBetween, hourLabel, isWithin, rangeEndingAt, weekday, weekdayName } from "./dates";

describe("addDays", () => {
  it("adds positive days without drifting across a month boundary", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });
  it("subtracts days", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("crosses a leap-year Feb 29", () => {
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2024-02-29", 1)).toBe("2024-03-01");
  });
});

describe("weekday / weekdayName", () => {
  it("matches a known date (2026-01-01 is a Thursday)", () => {
    expect(weekday("2026-01-01")).toBe(4);
    expect(weekdayName("2026-01-01")).toBe("Thursday");
  });
});

describe("daysBetween", () => {
  it("counts inclusive-exclusive span", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
  });
  it("is zero for the same date", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
  });
});

describe("rangeEndingAt", () => {
  it("builds an N-day inclusive range ending at the given date", () => {
    expect(rangeEndingAt("2026-01-10", 7)).toEqual({ from: "2026-01-04", to: "2026-01-10" });
  });
});

describe("isWithin", () => {
  it("is inclusive of both endpoints", () => {
    const range = { from: "2026-01-01", to: "2026-01-31" };
    expect(isWithin("2026-01-01", range)).toBe(true);
    expect(isWithin("2026-01-31", range)).toBe(true);
    expect(isWithin("2025-12-31", range)).toBe(false);
    expect(isWithin("2026-02-01", range)).toBe(false);
  });
});

describe("hourLabel", () => {
  it("offsets from the default HOUR_START", () => {
    expect(hourLabel(0)).toBe("07:00");
    expect(hourLabel(16)).toBe("23:00");
  });
  it("accepts a custom start", () => {
    expect(hourLabel(2, 0)).toBe("02:00");
  });
});
