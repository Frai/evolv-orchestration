import { describe, expect, it } from "vitest";
import type { LabourDay, SalesDay, Shift } from "../domain";
import { aggregateLabourDays, flaggedShifts, labourPct, labourPctBaseline, shiftHours } from "./labour";

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: "s1",
    role: "Server",
    start: "11:00",
    end: "15:00",
    scheduledStaff: 2,
    actualStaff: 2,
    neededStaff: 2,
    hourlyRate: 20,
    salesInWindow: 1000,
    ...overrides,
  };
}

function labourDay(overrides: Partial<LabourDay> = {}): LabourDay {
  return {
    locationId: "prairie-table",
    date: "2026-01-05",
    scheduledHours: 8,
    actualHours: 8,
    labourCost: 500,
    shifts: [shift()],
    ...overrides,
  };
}

function salesDay(overrides: Partial<SalesDay> = {}): SalesDay {
  return {
    locationId: "prairie-table",
    date: "2026-01-05",
    netSales: 2000,
    tax: 0,
    tips: 0,
    covers: 100,
    orders: 80,
    hourly: Array(17).fill(0),
    hourlyOrders: Array(17).fill(0),
    channels: { dine_in: 2000, takeout: 0, delivery: 0, room_service: 0 },
    lastYearNetSales: 1800,
    ...overrides,
  };
}

describe("aggregateLabourDays", () => {
  it("sums multiple outlet rows for the same date and namespaces shift ids by outlet", () => {
    const rows: LabourDay[] = [
      labourDay({ outletId: "grill", scheduledHours: 4, actualHours: 4, labourCost: 200, shifts: [shift({ id: "a" })] }),
      labourDay({ outletId: "bar", scheduledHours: 3, actualHours: 3, labourCost: 150, shifts: [shift({ id: "b" })] }),
    ];
    const [merged] = aggregateLabourDays(rows, "prairie-table");
    expect(merged.outletId).toBeUndefined();
    expect(merged.scheduledHours).toBe(7);
    expect(merged.actualHours).toBe(7);
    expect(merged.labourCost).toBe(350);
    expect(merged.shifts.map((s) => s.id)).toEqual(["grill:a", "bar:b"]);
  });

  it("sorts the result by date", () => {
    const rows = [labourDay({ date: "2026-01-06" }), labourDay({ date: "2026-01-01" })];
    expect(aggregateLabourDays(rows, "prairie-table").map((d) => d.date)).toEqual(["2026-01-01", "2026-01-06"]);
  });
});

describe("labourPct", () => {
  it("divides labour cost by net sales", () => {
    expect(labourPct(labourDay({ labourCost: 500 }), salesDay({ netSales: 2000 }))).toBe(0.25);
  });
  it("is null when either side is missing", () => {
    expect(labourPct(undefined, salesDay())).toBeNull();
    expect(labourPct(labourDay(), undefined)).toBeNull();
  });
  it("is null when net sales is zero", () => {
    expect(labourPct(labourDay(), salesDay({ netSales: 0 }))).toBeNull();
  });
});

describe("labourPctBaseline", () => {
  it("averages labour% over the same weekday across prior weeks", () => {
    const labourDays = [
      labourDay({ date: "2025-12-15", labourCost: 400 }),
      labourDay({ date: "2025-12-22", labourCost: 600 }),
    ];
    const salesDays = [salesDay({ date: "2025-12-15", netSales: 2000 }), salesDay({ date: "2025-12-22", netSales: 2000 })];
    // 2 weeks and 1 week before 2025-12-29 are 2025-12-15 and 2025-12-22.
    expect(labourPctBaseline(labourDays, salesDays, "2025-12-29", 2)).toBeCloseTo((0.2 + 0.3) / 2);
  });
  it("is null with no matching prior weeks", () => {
    expect(labourPctBaseline([], [], "2026-01-05")).toBeNull();
  });
});

describe("shiftHours", () => {
  it("computes duration across whole hours", () => {
    expect(shiftHours(shift({ start: "11:00", end: "15:00" }))).toBe(4);
  });
  it("handles half-hour boundaries", () => {
    expect(shiftHours(shift({ start: "10:30", end: "14:00" }))).toBe(3.5);
  });
});

describe("flaggedShifts", () => {
  it("computes excess staff and cost impact for overstaffed shifts", () => {
    const days = [
      labourDay({
        shifts: [shift({ actualStaff: 4, neededStaff: 2, hourlyRate: 20, start: "11:00", end: "15:00", flag: "overstaffed" })],
      }),
    ];
    const [flagged] = flaggedShifts(days, "overstaffed");
    expect(flagged.excessStaff).toBe(2);
    expect(flagged.hoursInWindow).toBe(4);
    expect(flagged.costImpact).toBe(160); // 2 excess * 4h * $20
  });

  it("only returns shifts matching the requested flag", () => {
    const days = [labourDay({ shifts: [shift({ flag: "understaffed" })] })];
    expect(flaggedShifts(days, "overstaffed")).toEqual([]);
  });

  it("sorts results by date descending", () => {
    const days = [
      labourDay({ date: "2026-01-01", shifts: [shift({ flag: "overstaffed" })] }),
      labourDay({ date: "2026-01-10", shifts: [shift({ flag: "overstaffed" })] }),
    ];
    expect(flaggedShifts(days, "overstaffed").map((f) => f.date)).toEqual(["2026-01-10", "2026-01-01"]);
  });
});
