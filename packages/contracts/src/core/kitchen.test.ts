import { describe, expect, it } from "vitest";
import type { Location, SalesDay } from "../domain";
import { HOUR_COUNT } from "../domain";
import { capacityFor, hourlyLoad, kitchenSeverity, peakKitchenLoad, peakWindowLabel } from "./kitchen";

function salesDay(hourlyOrders: number[]): SalesDay {
  return {
    locationId: "l",
    date: "2026-01-05",
    netSales: 0,
    tax: 0,
    tips: 0,
    covers: 0,
    orders: hourlyOrders.reduce((a, b) => a + b, 0),
    hourly: Array(HOUR_COUNT).fill(0),
    hourlyOrders,
    channels: { dine_in: 0, takeout: 0, delivery: 0, room_service: 0 },
    lastYearNetSales: 0,
  };
}

describe("hourlyLoad", () => {
  it("divides tickets per hour by capacity", () => {
    const day = salesDay([10, 20, 0, ...Array(HOUR_COUNT - 3).fill(0)]);
    expect(hourlyLoad(day, 10)).toEqual([1, 2, 0, ...Array(HOUR_COUNT - 3).fill(0)]);
  });
  it("is all zero with no capacity", () => {
    const day = salesDay(Array(HOUR_COUNT).fill(5));
    expect(hourlyLoad(day, 0).every((v) => v === 0)).toBe(true);
  });
});

describe("peakKitchenLoad", () => {
  it("finds the hour with the highest load ratio", () => {
    const orders = Array(HOUR_COUNT).fill(0);
    orders[5] = 30;
    orders[6] = 10;
    const peak = peakKitchenLoad(salesDay(orders), 10);
    expect(peak).toEqual({ index: 5, orders: 30, ratio: 3 });
  });
});

describe("kitchenSeverity", () => {
  it("is null below the warning ratio", () => {
    expect(kitchenSeverity(1.0)).toBeNull();
  });
  it("is warning at or above 1.3 and below 1.6", () => {
    expect(kitchenSeverity(1.3)).toBe("warning");
    expect(kitchenSeverity(1.59)).toBe("warning");
  });
  it("is critical at or above 1.6", () => {
    expect(kitchenSeverity(1.6)).toBe("critical");
    expect(kitchenSeverity(3)).toBe("critical");
  });
});

describe("capacityFor", () => {
  const location: Location = {
    id: "kensington-hotel",
    name: "Kensington Hotel",
    shortName: "Kensington",
    type: "hotel",
    pos: "toast",
    city: "Calgary",
    currency: "CAD",
    targetLabourPct: 0.28,
    menuItemCount: 40,
    staffCount: 50,
    wageBands: [],
    kitchenTicketCapacityPerHour: 100,
    outlets: [{ id: "restaurant", name: "Restaurant", kind: "restaurant", kitchenTicketCapacityPerHour: 60 }],
    owner: { name: "Owner", phone: "555", email: "owner@example.com" },
  };

  it("returns the location total when no outlet is given", () => {
    expect(capacityFor(location)).toBe(100);
  });
  it("returns the outlet's own capacity when given and found", () => {
    expect(capacityFor(location, "restaurant")).toBe(60);
  });
  it("falls back to the location total when the outlet id is not found", () => {
    expect(capacityFor(location, "nonexistent")).toBe(100);
  });
});

describe("peakWindowLabel", () => {
  it("formats an hour index as a one-hour window", () => {
    expect(peakWindowLabel(0)).toBe("07:00–08:00");
  });
});
