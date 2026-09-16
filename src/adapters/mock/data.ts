// The only place that touches /fixtures. Everything else goes through ports.
import meta from "@/fixtures/meta.json";
import locations from "@/fixtures/locations.json";
import sales from "@/fixtures/sales.json";
import menus from "@/fixtures/menus.json";
import itemSeries from "@/fixtures/item-sales.json";
import labour from "@/fixtures/labour.json";
import stock from "@/fixtures/stock.json";
import briefs from "@/fixtures/briefs.json";
import agents from "@/fixtures/agents.json";
import runs from "@/fixtures/agent-runs.json";
import approvals from "@/fixtures/approvals.json";
import integrations from "@/fixtures/integrations.json";
import qa from "@/fixtures/qa.json";
import deliveries from "@/fixtures/deliveries.json";
import type { Agent, AgentRun, Approval, Brief, DeliveryChannel, Integration, LabourDay, Location, MenuItem, QAPair, SalesDay, StockLevel } from "@/core/types";

export interface Meta {
  generatedAt: string;
  today: string;
  asOf: string;
  dates: string[];
}

export interface ItemSeries {
  locationId: string;
  outletId?: string;
  itemId: string;
  qty: number[];
}

export interface MenuFixture {
  locationId: string;
  outletId?: string;
  items: MenuItem[];
}

export interface DeliveryFixture {
  locationId: string;
  channel: DeliveryChannel;
  sentAt: string;
  to: string[];
}

export interface IntegrationFixture {
  locationId: string;
  integrations: Integration[];
}

export const fixtures = {
  meta: meta as Meta,
  locations: locations as Location[],
  sales: sales as SalesDay[],
  menus: menus as MenuFixture[],
  itemSeries: itemSeries as ItemSeries[],
  labour: labour as LabourDay[],
  stock: stock as StockLevel[],
  briefs: briefs as Brief[],
  agents: agents as Agent[],
  runs: runs as AgentRun[],
  approvals: approvals as Approval[],
  integrations: integrations as IntegrationFixture[],
  qa: qa as QAPair[],
  deliveries: deliveries as DeliveryFixture[],
};

/** Simulated network latency so loading states are exercised. */
export const latency = <T>(value: T, ms = 120): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
