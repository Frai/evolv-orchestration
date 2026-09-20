import { Injectable } from "@nestjs/common";
import type { SalesQuery, SalesSource } from "@evolv/contracts/ports";
import type { ItemSales, Location, MenuItem, SalesDay } from "@evolv/contracts/types";

/**
 * Stub for a real Square POS integration. Not wired into SalesModule yet —
 * present so the shape of a real adapter is visible before any vendor work starts.
 * See docs/ARCHITECTURE.md for how to wire this in.
 */
@Injectable()
export class SquarePOSAdapter implements SalesSource {
  async listLocations(): Promise<Location[]> {
    throw new Error("not implemented — Square");
  }
  async getLocation(_id: string): Promise<Location | undefined> {
    throw new Error("not implemented — Square");
  }
  async latestDate(_locationId: string): Promise<string> {
    throw new Error("not implemented — Square");
  }
  async getSalesDays(_q: SalesQuery): Promise<SalesDay[]> {
    // TODO: wire real Square API (Orders/Payments API, exchange OAuth token for the location)
    throw new Error("not implemented — Square");
  }
  async getMenu(_locationId: string, _outletId?: string): Promise<MenuItem[]> {
    // TODO: wire real Square Catalog API
    throw new Error("not implemented — Square");
  }
  async getItemSales(_q: SalesQuery): Promise<ItemSales[]> {
    // TODO: wire real Square Orders API, line-item breakdown
    throw new Error("not implemented — Square");
  }
}
