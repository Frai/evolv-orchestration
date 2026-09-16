import type { Integration, IntegrationArea, IntegrationState, Location } from "@/core/types";

type Catalog = Omit<Integration, "state" | "lastSyncAt"> & { defaultState: IntegrationState };

const C = (id: string, name: string, area: IntegrationArea, description: string, defaultState: IntegrationState): Catalog => ({ id, name, area, description, defaultState });

export const CATALOG: Catalog[] = [
  C("square", "Square", "pos", "Sales, items, and hourly breakdowns from Square for Restaurants.", "available"),
  C("toast", "Toast", "pos", "Checks, items, and labour from Toast, including multi-outlet setups.", "available"),
  C("lightspeed", "Lightspeed", "pos", "Sales and menu data from Lightspeed Restaurant (K-Series and L-Series).", "available"),
  C("touchbistro", "TouchBistro", "pos", "Sales and items from TouchBistro.", "coming_soon"),
  C("clover", "Clover", "pos", "Sales and items from Clover.", "coming_soon"),
  C("7shifts", "7shifts", "scheduling", "Scheduled and actual hours, roles, and wage bands.", "available"),
  C("homebase", "Homebase", "scheduling", "Schedules, time clocks, and labour cost.", "available"),
  C("hotschedules", "HotSchedules", "scheduling", "Schedules and labour from HotSchedules by Fourth.", "coming_soon"),
  C("marketman", "MarketMan", "inventory", "Stock counts, par levels, and supplier orders.", "available"),
  C("marginedge", "MarginEdge", "inventory", "Invoices, food cost, and inventory counts.", "available"),
  C("xtrachef", "xtraCHEF", "inventory", "Invoice capture and food cost from xtraCHEF by Toast.", "coming_soon"),
  C("qbo", "QuickBooks Online", "accounting", "P&L, expenses, and bank balances.", "available"),
  C("xero", "Xero", "accounting", "P&L, expenses, and bank balances.", "available"),
  C("sage", "Sage", "accounting", "P&L and expenses from Sage 50 and Sage Intacct.", "coming_soon"),
  C("skip", "Skip", "delivery", "Order volume, commissions, and ratings from SkipTheDishes.", "available"),
  C("doordash", "DoorDash", "delivery", "Order volume, commissions, and ratings from DoorDash.", "available"),
  C("ubereats", "Uber Eats", "delivery", "Order volume, commissions, and ratings from Uber Eats.", "available"),
  C("opentable", "OpenTable", "reservations", "Covers booked, no-shows, and guest notes.", "available"),
  C("resy", "Resy", "reservations", "Covers booked, no-shows, and guest notes.", "coming_soon"),
  C("whatsapp", "WhatsApp", "messaging", "Morning brief and alerts to your phone.", "available"),
  C("email", "Email", "messaging", "Morning brief and alerts to your inbox.", "available"),
  C("sms", "SMS", "messaging", "Critical alerts by text message.", "coming_soon"),
];

const SEVEN_SHIFTS = ["prairie-table", "northside-cantina"];

export function integrationsFor(location: Location, syncIso: string): Integration[] {
  return CATALOG.map((c) => {
    let state: IntegrationState = c.defaultState;
    if (c.area === "pos" && c.id === location.pos) state = "connected";
    if (c.id === "7shifts" && SEVEN_SHIFTS.includes(location.id)) state = "connected";
    if (c.id === "whatsapp") state = "connected";
    const { defaultState, ...rest } = c;
    void defaultState;
    return { ...rest, state, lastSyncAt: state === "connected" ? syncIso : undefined };
  });
}

export function hasSevenShifts(locationId: string) {
  return SEVEN_SHIFTS.includes(locationId);
}
