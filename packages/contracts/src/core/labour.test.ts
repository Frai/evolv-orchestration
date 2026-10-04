import { describe, expect, it } from "vitest";
import { hoursByCode, overtimePct, weekStart, weeklyHours } from "./labour";
import { day } from "./test-helpers";

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-01-07")).toBe("2026-01-05"); // Wednesday
    expect(weekStart("2026-01-05")).toBe("2026-01-05"); // Monday
    expect(weekStart("2026-01-11")).toBe("2026-01-05"); // Sunday belongs to the prior Monday
  });
});

describe("overtimePct", () => {
  const range = { from: "2026-01-05", to: "2026-01-11" };
  it("divides overtime by total labour hours", () => {
    const days = [day({ date: "2026-01-05", hours: 80, overtimeHours: 8 }), day({ date: "2026-01-06", hours: 20, overtimeHours: 12 })];
    expect(overtimePct(days, range)).toBeCloseTo(0.2);
  });
  it("is null with no labour hours", () => {
    expect(overtimePct([day({ cost: 100 })], range)).toBeNull();
  });
  it("ignores rows outside the range", () => {
    expect(overtimePct([day({ date: "2026-02-01", hours: 10, overtimeHours: 10 })], range)).toBeNull();
  });
});

describe("weeklyHours", () => {
  it("splits regular and overtime per week, oldest first", () => {
    const days = [
      day({ date: "2026-01-13", hours: 40, overtimeHours: 10, cost: 1_000 }),
      day({ date: "2026-01-06", hours: 30, overtimeHours: 0, cost: 800 }),
      day({ date: "2026-01-07", hours: 10, overtimeHours: 2, cost: 300 }),
    ];
    const w = weeklyHours(days, { from: "2026-01-01", to: "2026-01-31" });
    expect(w.map((x) => x.weekStart)).toEqual(["2026-01-05", "2026-01-12"]);
    expect(w[0]).toMatchObject({ regular: 38, overtime: 2, cost: 1_100 });
    expect(w[1]).toMatchObject({ regular: 30, overtime: 10 });
  });
});

describe("hoursByCode", () => {
  it("ranks codes by overtime share", () => {
    const days = [day({ codeId: "a", hours: 100, overtimeHours: 5 }), day({ codeId: "b", hours: 50, overtimeHours: 25 })];
    const r = hoursByCode(days, { from: "2026-01-01", to: "2026-01-31" });
    expect(r.map((x) => x.codeId)).toEqual(["b", "a"]);
    expect(r[0].overtimePct).toBeCloseTo(0.5);
  });
});
