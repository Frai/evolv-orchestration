import { describe, expect, it } from "vitest";
import type { LabourDay, Location, SalesDay } from "../domain";
import { HOUR_COUNT } from "../domain";
import { buildBriefInput } from "./brief";

const LOCATION: Location = {
  id: "prairie-table",
  name: "Prairie Table",
  shortName: "Prairie",
  type: "full_service",
  pos: "toast",
  city: "Calgary",
  currency: "CAD",
  targetLabourPct: 0.28,
  menuItemCount: 2,
  staffCount: 10,
  wageBands: [],
  kitchenTicketCapacityPerHour: 40,
  owner: { name: "Owner", phone: "555", email: "owner@example.com" },
};

function salesDay(overrides: Partial<SalesDay> = {}): SalesDay {
  const hourly = Array(HOUR_COUNT).fill(0);
  hourly[5] = 800;
  return {
    locationId: "prairie-table",
    date: "2026-01-05",
    netSales: 2000,
    tax: 0,
    tips: 0,
    covers: 100,
    orders: 80,
    hourly,
    hourlyOrders: Array(HOUR_COUNT).fill(0),
    channels: { dine_in: 1500, takeout: 300, delivery: 200, room_service: 0 },
    lastYearNetSales: 1800,
    ...overrides,
  };
}

function labourDay(overrides: Partial<LabourDay> = {}): LabourDay {
  return {
    locationId: "prairie-table",
    date: "2026-01-05",
    scheduledHours: 40,
    actualHours: 40,
    labourCost: 560,
    shifts: [],
    ...overrides,
  };
}

describe("buildBriefInput", () => {
  it("returns null when there is no sales day for the given date", () => {
    expect(buildBriefInput(LOCATION, "2026-01-05", [], [])).toBeNull();
  });

  it("computes derived fields for a day with sales and labour data", () => {
    const day = salesDay({ date: "2026-01-05", netSales: 2000, covers: 100, lastYearNetSales: 1800 });
    const labour = labourDay({ date: "2026-01-05", labourCost: 560 });
    const input = buildBriefInput(LOCATION, "2026-01-05", [day], [labour]);

    expect(input).not.toBeNull();
    expect(input!.netSales).toBe(2000);
    expect(input!.avgCheck).toBe(20); // 2000 / 100 covers
    expect(input!.labourPct).toBeCloseTo(0.28); // 560 / 2000
    expect(input!.targetLabourPct).toBe(0.28);
    expect(input!.yoyDelta).toBeCloseTo((2000 - 1800) / 1800);
    expect(input!.deliveryShare).toBeCloseTo(200 / 2000); // delivery channel only, no room_service
    expect(input!.peakHourIndex).toBe(5);
    expect(input!.peakHourSales).toBe(800);
  });

  it("handles a day with no labour data — labourPct and its delta are null", () => {
    const day = salesDay({ date: "2026-01-05" });
    const input = buildBriefInput(LOCATION, "2026-01-05", [day], []);
    expect(input!.labourPct).toBeNull();
    expect(input!.labourPctDelta).toBeNull();
  });

  it("has no baseline deltas with no prior-week history", () => {
    const day = salesDay({ date: "2026-01-05" });
    const input = buildBriefInput(LOCATION, "2026-01-05", [day], []);
    expect(input!.netSalesBaseline).toBeNull();
    expect(input!.netSalesDelta).toBeNull();
  });

  it("avgCheck is zero with zero covers", () => {
    const day = salesDay({ date: "2026-01-05", covers: 0 });
    const input = buildBriefInput(LOCATION, "2026-01-05", [day], []);
    expect(input!.avgCheck).toBe(0);
  });
});
