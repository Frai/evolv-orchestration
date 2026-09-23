import { describe, expect, it } from "vitest";
import type { StockLevel } from "../domain";
import { daysOfCover, reorderCost, reorderQty, sortByUrgency, stockStatus } from "./inventory";

function stock(overrides: Partial<StockLevel> = {}): StockLevel {
  return {
    locationId: "prairie-table",
    itemId: "flour",
    name: "Flour",
    category: "dry goods",
    unit: "kg",
    onHand: 50,
    par: 50,
    dailyUsage: 5,
    unitCost: 2,
    supplier: "Sysco",
    countedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("daysOfCover", () => {
  it("divides on-hand by daily usage", () => {
    expect(daysOfCover(stock({ onHand: 20, dailyUsage: 5 }))).toBe(4);
  });
  it("is infinite when there is no daily usage", () => {
    expect(daysOfCover(stock({ dailyUsage: 0 }))).toBe(Infinity);
  });
});

describe("stockStatus", () => {
  it("is ok at or above 125% of par", () => {
    expect(stockStatus(stock({ par: 100, onHand: 130 }))).toBe("ok");
  });
  it("is low between 100% and 125% of par", () => {
    expect(stockStatus(stock({ par: 100, onHand: 110 }))).toBe("low");
  });
  it("is below_par between 25% and 100% of par", () => {
    expect(stockStatus(stock({ par: 100, onHand: 50 }))).toBe("below_par");
  });
  it("is critical under 25% of par", () => {
    expect(stockStatus(stock({ par: 100, onHand: 10 }))).toBe("critical");
  });
});

describe("sortByUrgency", () => {
  it("orders critical, then below_par, then low, then ok, breaking ties by days of cover", () => {
    const ok = stock({ itemId: "ok", par: 100, onHand: 130, dailyUsage: 1 });
    const low = stock({ itemId: "low", par: 100, onHand: 110, dailyUsage: 1 });
    const belowParSlow = stock({ itemId: "below-slow", par: 100, onHand: 50, dailyUsage: 1 });
    const belowParFast = stock({ itemId: "below-fast", par: 100, onHand: 50, dailyUsage: 10 });
    const critical = stock({ itemId: "critical", par: 100, onHand: 10, dailyUsage: 1 });

    const sorted = sortByUrgency([ok, low, belowParSlow, critical, belowParFast]);
    expect(sorted.map((s) => s.itemId)).toEqual(["critical", "below-fast", "below-slow", "low", "ok"]);
  });
});

describe("reorderQty", () => {
  it("rounds up to a 50-unit pack when par is 200+", () => {
    expect(reorderQty(stock({ par: 220 }))).toBe(250);
  });
  it("rounds up to a 10-unit pack when par is 40-199", () => {
    expect(reorderQty(stock({ par: 45 }))).toBe(50);
  });
  it("rounds up to a 5-unit pack when par is 10-39", () => {
    expect(reorderQty(stock({ par: 12 }))).toBe(15);
  });
  it("uses 1-unit packs below par 10", () => {
    expect(reorderQty(stock({ par: 3 }))).toBe(3);
  });
  it("never reorders less than one pack", () => {
    expect(reorderQty(stock({ par: 0 }))).toBe(1);
  });
});

describe("reorderCost", () => {
  it("multiplies reorder quantity by unit cost, rounded to cents", () => {
    // par 12 -> pack of 5 -> reorderQty 15; 15 * 3.333 = 49.995, rounds to 50.
    expect(reorderQty(stock({ par: 12 }))).toBe(15);
    expect(reorderCost(stock({ par: 12, unitCost: 3.333 }))).toBe(50);
  });
});
