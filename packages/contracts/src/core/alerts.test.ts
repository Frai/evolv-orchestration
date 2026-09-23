import { describe, expect, it } from "vitest";
import type { LabourDay, Location, SalesDay, Shift, StockLevel } from "../domain";
import { HOUR_COUNT } from "../domain";
import { detectAlerts } from "./alerts";

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
  return {
    locationId: "prairie-table",
    date: "2026-01-05",
    netSales: 5000,
    tax: 0,
    tips: 0,
    covers: 200,
    orders: 150,
    hourly: Array(HOUR_COUNT).fill(0),
    hourlyOrders: Array(HOUR_COUNT).fill(0),
    channels: { dine_in: 5000, takeout: 0, delivery: 0, room_service: 0 },
    lastYearNetSales: 4500,
    ...overrides,
  };
}

function labourDay(overrides: Partial<LabourDay> = {}, shifts: Shift[] = []): LabourDay {
  return {
    locationId: "prairie-table",
    date: "2026-01-05",
    scheduledHours: 40,
    actualHours: 40,
    labourCost: 1400,
    shifts,
    ...overrides,
  };
}

function baseSalesHistory(date: string, netSales: number): SalesDay[] {
  // Four prior same-weekday rows plus the day itself, all at a flat baseline.
  const rows: SalesDay[] = [];
  for (let w = 4; w >= 1; w--) rows.push(salesDay({ date: shiftWeeks(date, -w), netSales: 5000 }));
  rows.push(salesDay({ date, netSales }));
  return rows;
}

function shiftWeeks(date: string, weeks: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

describe("detectAlerts — sales", () => {
  it("flags a sales drop of 15% or more vs the same-weekday baseline", () => {
    const date = "2026-02-02";
    const salesDays = baseSalesHistory(date, 4000); // -20% vs 5000 baseline
    const alerts = detectAlerts({ location: LOCATION, date, salesDays, labourDays: [], stock: [], itemSales: [], menu: [] });
    expect(alerts.some((a) => a.source === "sales" && a.severity === "warning" && a.title.includes("Net sales"))).toBe(true);
  });

  it("flags an unusual spike of 25% or more vs baseline", () => {
    const date = "2026-02-02";
    const salesDays = baseSalesHistory(date, 7000); // +40%
    const alerts = detectAlerts({ location: LOCATION, date, salesDays, labourDays: [], stock: [], itemSales: [], menu: [] });
    expect(alerts.some((a) => a.source === "sales" && a.severity === "info" && a.title.includes("spike"))).toBe(true);
  });

  it("raises no sales alert within normal variance", () => {
    const date = "2026-02-02";
    const salesDays = baseSalesHistory(date, 5100); // +2%
    const alerts = detectAlerts({ location: LOCATION, date, salesDays, labourDays: [], stock: [], itemSales: [], menu: [] });
    expect(alerts.some((a) => a.source === "sales" && a.title.includes("Net sales"))).toBe(false);
  });
});

describe("detectAlerts — labour", () => {
  it("flags labour at or above target + 3pts", () => {
    const date = "2026-01-05";
    const day = salesDay({ date, netSales: 1000 });
    const labour = labourDay({ date, labourCost: 320 }); // 32% vs 28% target
    const alerts = detectAlerts({ location: LOCATION, date, salesDays: [day], labourDays: [labour], stock: [], itemSales: [], menu: [] });
    expect(alerts.some((a) => a.source === "labour" && a.title.includes("Labour at"))).toBe(true);
  });

  it("escalates to critical at target + 8pts", () => {
    const date = "2026-01-05";
    const day = salesDay({ date, netSales: 1000 });
    const labour = labourDay({ date, labourCost: 400 }); // 40% vs 28% target
    const alerts = detectAlerts({ location: LOCATION, date, salesDays: [day], labourDays: [labour], stock: [], itemSales: [], menu: [] });
    const labourAlert = alerts.find((a) => a.title.includes("Labour at"));
    expect(labourAlert?.severity).toBe("critical");
  });

  it("flags overstaffed and understaffed shifts individually", () => {
    const date = "2026-01-05";
    const shifts: Shift[] = [
      { id: "s1", role: "Server", start: "11:00", end: "15:00", scheduledStaff: 4, actualStaff: 4, neededStaff: 2, hourlyRate: 20, salesInWindow: 500, flag: "overstaffed" },
      { id: "s2", role: "Cook", start: "16:00", end: "22:00", scheduledStaff: 1, actualStaff: 1, neededStaff: 3, hourlyRate: 25, salesInWindow: 2000, flag: "understaffed" },
    ];
    const day = salesDay({ date, netSales: 1000 });
    const labour = labourDay({ date, labourCost: 280 }, shifts);
    const alerts = detectAlerts({ location: LOCATION, date, salesDays: [day], labourDays: [labour], stock: [], itemSales: [], menu: [] });
    expect(alerts.some((a) => a.title.includes("Overstaffed"))).toBe(true);
    expect(alerts.some((a) => a.title.includes("Understaffed"))).toBe(true);
  });
});

describe("detectAlerts — inventory", () => {
  function stockItem(overrides: Partial<StockLevel>): StockLevel {
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
      countedAt: "2026-01-05T00:00:00.000Z",
      ...overrides,
    };
  }

  it("flags critically low stock", () => {
    const date = "2026-01-05";
    const stock = [stockItem({ itemId: "flour", name: "Flour", par: 100, onHand: 5 })];
    const alerts = detectAlerts({ location: LOCATION, date, salesDays: [], labourDays: [], stock, itemSales: [], menu: [] });
    expect(alerts.some((a) => a.source === "inventory" && a.severity === "critical")).toBe(true);
  });

  it("flags below-par stock as a warning, distinct from critical", () => {
    const date = "2026-01-05";
    const stock = [stockItem({ itemId: "milk", name: "Milk", par: 100, onHand: 50 })];
    const alerts = detectAlerts({ location: LOCATION, date, salesDays: [], labourDays: [], stock, itemSales: [], menu: [] });
    const inventoryAlerts = alerts.filter((a) => a.source === "inventory");
    expect(inventoryAlerts).toHaveLength(1);
    expect(inventoryAlerts[0].severity).toBe("warning");
  });
});

describe("detectAlerts — ordering", () => {
  it("sorts critical before warning before info", () => {
    const date = "2026-01-05";
    const stock: StockLevel[] = [
      { locationId: "prairie-table", itemId: "a", name: "A", category: "x", unit: "kg", onHand: 1, par: 50, dailyUsage: 1, unitCost: 1, supplier: "s", countedAt: date },
    ];
    const salesDays = baseSalesHistory(date, 7000); // spike -> info
    const alerts = detectAlerts({ location: LOCATION, date, salesDays, labourDays: [], stock, itemSales: [], menu: [] });
    const severities = alerts.map((a) => a.severity);
    const order = { critical: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < severities.length; i++) expect(order[severities[i]]).toBeGreaterThanOrEqual(order[severities[i - 1]]);
  });
});
