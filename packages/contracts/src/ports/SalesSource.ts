import type { DateRange, ItemSales, Location, MenuItem, SalesDay } from "../domain";

export interface SalesQuery {
  locationId: string;
  /** Hotels only. Omit to roll all outlets up. */
  outletId?: string;
  range: DateRange;
}

export interface SalesSource {
  listLocations(): Promise<Location[]>;
  getLocation(id: string): Promise<Location | undefined>;
  /** The most recent closed business day available from the source. */
  latestDate(locationId: string): Promise<string>;
  getSalesDays(q: SalesQuery): Promise<SalesDay[]>;
  getMenu(locationId: string, outletId?: string): Promise<MenuItem[]>;
  getItemSales(q: SalesQuery): Promise<ItemSales[]>;
}
