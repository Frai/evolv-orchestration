import { describe, expect, it } from "vitest";
import type { ItemSales, MenuItem, SalesDay } from "../domain";
import { HOUR_COUNT } from "../domain";
import {
  aggregateItemSales,
  aggregateSalesDays,
  channelShare,
  deadItems,
  delta,
  deliveryShare,
  findDay,
  hourlyHeatmap,
  inRange,
  itemTotals,
  peakHour,
  sameWeekdayBaseline,
  topItems,
} from "./sales";

function salesDay(overrides: Partial<SalesDay> = {}): SalesDay {
  return {
    locationId: "prairie-table",
    date: "2026-01-05",
    netSales: 1000,
    tax: 50,
    tips: 100,
    covers: 50,
    orders: 40,
    hourly: Array(HOUR_COUNT).fill(0),
    hourlyOrders: Array(HOUR_COUNT).fill(0),
    channels: { dine_in: 700, takeout: 200, delivery: 100, room_service: 0 },
    lastYearNetSales: 900,
    ...overrides,
  };
}

describe("aggregateSalesDays", () => {
  it("rolls multiple outlet rows into one row per date, summing numeric fields", () => {
    const a = salesDay({ outletId: "grill", netSales: 600, tax: 30, tips: 60, covers: 30, orders: 25, lastYearNetSales: 500 });
    const b = salesDay({ outletId: "bar", netSales: 400, tax: 20, tips: 40, covers: 20, orders: 15, lastYearNetSales: 400 });
    a.hourly[0] = 100;
    b.hourly[0] = 50;
    a.hourlyOrders[0] = 5;
    b.hourlyOrders[0] = 3;

    const [merged] = aggregateSalesDays([a, b], "prairie-table");
    expect(merged.outletId).toBeUndefined();
    expect(merged.netSales).toBe(1000);
    expect(merged.tax).toBe(50);
    expect(merged.tips).toBe(100);
    expect(merged.covers).toBe(50);
    expect(merged.orders).toBe(40);
    expect(merged.lastYearNetSales).toBe(900);
    expect(merged.hourly[0]).toBe(150);
    expect(merged.hourlyOrders[0]).toBe(8);
    expect(merged.channels.dine_in).toBe(1400);
  });

  it("sorts by date", () => {
    const rows = [salesDay({ date: "2026-01-09" }), salesDay({ date: "2026-01-01" })];
    expect(aggregateSalesDays(rows, "prairie-table").map((d) => d.date)).toEqual(["2026-01-01", "2026-01-09"]);
  });

  it("does not mutate its inputs", () => {
    const a = salesDay({ outletId: "grill" });
    const original = a.netSales;
    aggregateSalesDays([a, salesDay({ outletId: "bar" })], "prairie-table");
    expect(a.netSales).toBe(original);
  });
});

describe("aggregateItemSales", () => {
  it("merges rows for the same date+item across outlets", () => {
    const rows: ItemSales[] = [
      { locationId: "l", outletId: "a", date: "2026-01-05", itemId: "burger", name: "Burger", category: "mains", qty: 3, netSales: 30 },
      { locationId: "l", outletId: "b", date: "2026-01-05", itemId: "burger", name: "Burger", category: "mains", qty: 2, netSales: 20 },
    ];
    const merged = aggregateItemSales(rows, "l");
    expect(merged).toHaveLength(1);
    expect(merged[0].qty).toBe(5);
    expect(merged[0].netSales).toBe(50);
    expect(merged[0].outletId).toBeUndefined();
  });
});

describe("findDay", () => {
  it("finds by exact date match", () => {
    const days = [salesDay({ date: "2026-01-01" }), salesDay({ date: "2026-01-02" })];
    expect(findDay(days, "2026-01-02")?.date).toBe("2026-01-02");
    expect(findDay(days, "2026-03-01")).toBeUndefined();
  });
});

describe("sameWeekdayBaseline", () => {
  it("averages the same weekday over the previous N weeks, excluding the date itself", () => {
    const days = [
      salesDay({ date: "2025-12-01", netSales: 100 }), // Monday
      salesDay({ date: "2025-12-08", netSales: 200 }), // Monday
      salesDay({ date: "2025-12-15", netSales: 300 }), // Monday, the date itself
    ];
    expect(sameWeekdayBaseline(days, "2025-12-15", 2)).toBe(150);
  });
  it("is null with no prior matches", () => {
    expect(sameWeekdayBaseline([], "2026-01-05")).toBeNull();
  });
});

describe("delta", () => {
  it("computes relative change", () => {
    expect(delta(120, 100)).toBeCloseTo(0.2);
    expect(delta(80, 100)).toBeCloseTo(-0.2);
  });
  it("is null when there is no baseline or the baseline is zero", () => {
    expect(delta(100, null)).toBeNull();
    expect(delta(100, 0)).toBeNull();
  });
});

describe("deliveryShare / channelShare", () => {
  it("combines delivery and room_service for deliveryShare", () => {
    const d = salesDay({ netSales: 1000, channels: { dine_in: 500, takeout: 100, delivery: 300, room_service: 100 } });
    expect(deliveryShare(d)).toBeCloseTo(0.4);
  });
  it("is zero when net sales is zero", () => {
    expect(deliveryShare(salesDay({ netSales: 0 }))).toBe(0);
  });
  it("channelShare reads a single channel's share", () => {
    const d = salesDay({ netSales: 1000, channels: { dine_in: 700, takeout: 300, delivery: 0, room_service: 0 } });
    expect(channelShare(d, "takeout")).toBeCloseTo(0.3);
  });
});

describe("peakHour", () => {
  it("finds the index and value of the busiest hour", () => {
    const d = salesDay();
    d.hourly[3] = 50;
    d.hourly[9] = 500;
    d.hourly[10] = 200;
    expect(peakHour(d)).toEqual({ index: 9, value: 500 });
  });
});

describe("hourlyHeatmap", () => {
  it("averages hourly net sales per weekday across the given days", () => {
    const mon1 = salesDay({ date: "2025-12-01" });
    const mon2 = salesDay({ date: "2025-12-08" });
    mon1.hourly[0] = 100;
    mon2.hourly[0] = 300;
    const heatmap = hourlyHeatmap([mon1, mon2]);
    const mondayRow = 1; // weekday() 0=Sun, Monday=1
    expect(heatmap[mondayRow][0]).toBe(200);
  });
  it("is zero for weekdays with no data", () => {
    const heatmap = hourlyHeatmap([salesDay({ date: "2025-12-01" })]);
    expect(heatmap[0].every((v) => v === 0)).toBe(true); // no Sunday rows
  });
});

const MENU: MenuItem[] = [
  { id: "burger", name: "Burger", category: "mains", price: 15 },
  { id: "fries", name: "Fries", category: "sides", price: 5 },
];
const menuMap = new Map(MENU.map((m) => [m.id, m]));

describe("itemTotals", () => {
  it("sums quantity and net sales within range, and includes zero-sales menu items", () => {
    const rows: ItemSales[] = [
      { locationId: "l", date: "2026-01-01", itemId: "burger", name: "Burger", category: "mains", qty: 2, netSales: 30 },
      { locationId: "l", date: "2026-01-02", itemId: "burger", name: "Burger", category: "mains", qty: 1, netSales: 15 },
      { locationId: "l", date: "2026-02-15", itemId: "burger", name: "Burger", category: "mains", qty: 99, netSales: 999 }, // out of range
    ];
    const totals = itemTotals(rows, { from: "2026-01-01", to: "2026-01-07" }, menuMap);
    const burger = totals.find((t) => t.id === "burger")!;
    const fries = totals.find((t) => t.id === "fries")!;
    expect(burger.qty).toBe(3);
    expect(burger.netSales).toBe(45);
    expect(fries.qty).toBe(0);
  });

  it("computes perWeek from the range length", () => {
    const rows: ItemSales[] = [{ locationId: "l", date: "2026-01-01", itemId: "burger", name: "Burger", category: "mains", qty: 14, netSales: 210 }];
    const totals = itemTotals(rows, { from: "2026-01-01", to: "2026-01-14" }, menuMap); // 14-day window
    expect(totals.find((t) => t.id === "burger")!.perWeek).toBeCloseTo(7);
  });
});

describe("topItems / deadItems", () => {
  it("topItems sorts by net sales descending and slices to n", () => {
    const totals = itemTotals(
      [
        { locationId: "l", date: "2026-01-01", itemId: "burger", name: "Burger", category: "mains", qty: 1, netSales: 15 },
        { locationId: "l", date: "2026-01-01", itemId: "fries", name: "Fries", category: "sides", qty: 10, netSales: 50 },
      ],
      { from: "2026-01-01", to: "2026-01-01" },
      menuMap,
    );
    expect(topItems(totals, 1).map((t) => t.id)).toEqual(["fries"]);
  });

  it("deadItems returns items selling under the per-week threshold, ascending", () => {
    const totals = itemTotals(
      [{ locationId: "l", date: "2026-01-01", itemId: "burger", name: "Burger", category: "mains", qty: 1, netSales: 15 }],
      { from: "2026-01-01", to: "2026-01-07" },
      menuMap,
    );
    const dead = deadItems(totals);
    expect(dead.map((t) => t.id)).toContain("fries"); // zero sales, definitely dead
  });
});

describe("inRange", () => {
  it("filters days to the inclusive range", () => {
    const days = [salesDay({ date: "2026-01-01" }), salesDay({ date: "2026-01-15" }), salesDay({ date: "2026-02-01" })];
    expect(inRange(days, { from: "2026-01-01", to: "2026-01-31" }).map((d) => d.date)).toEqual(["2026-01-01", "2026-01-15"]);
  });
});
