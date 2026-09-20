import { Injectable } from "@nestjs/common";
import type {
  Agent,
  AgentRun,
  Approval,
  Brief,
  DeliveryChannel,
  Integration,
  LabourDay,
  Location,
  MenuItem,
  QAPair,
  SalesDay,
  StockLevel,
} from "@evolv/contracts/types";
import meta from "./data/meta.json";
import locations from "./data/locations.json";
import sales from "./data/sales.json";
import menus from "./data/menus.json";
import itemSeries from "./data/item-sales.json";
import labour from "./data/labour.json";
import stock from "./data/stock.json";
import briefs from "./data/briefs.json";
import agents from "./data/agents.json";
import runs from "./data/agent-runs.json";
import approvals from "./data/approvals.json";
import integrations from "./data/integrations.json";
import qa from "./data/qa.json";
import deliveries from "./data/deliveries.json";

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

/**
 * The only place in apps/api that touches the generated fixture JSON.
 * Every Mock*Provider is injected with this service instead of importing JSON directly,
 * so swapping fixtures for a real data source never touches provider constructors' shape.
 */
@Injectable()
export class FixturesService {
  readonly meta = meta as Meta;
  readonly locations = locations as Location[];
  readonly sales = sales as SalesDay[];
  readonly menus = menus as MenuFixture[];
  readonly itemSeries = itemSeries as ItemSeries[];
  readonly labour = labour as LabourDay[];
  readonly stock = stock as StockLevel[];
  readonly briefs = briefs as Brief[];
  readonly agents = agents as Agent[];
  readonly runs = runs as AgentRun[];
  readonly approvals = approvals as Approval[];
  readonly integrations = integrations as IntegrationFixture[];
  readonly qa = qa as QAPair[];
  readonly deliveries = deliveries as DeliveryFixture[];
}

/** Simulated network latency so loading states are exercised on the frontend. */
export const latency = <T>(value: T, ms = 120): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));
