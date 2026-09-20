import { Injectable } from "@nestjs/common";
import type { SalesQuery, SalesSource } from "@evolv/contracts/ports";
import type { ItemSales, Location, MenuItem, SalesDay } from "@evolv/contracts/types";

/**
 * Stub for a real Toast POS integration. Not wired into SalesModule yet —
 * present so the shape of a real adapter is visible before any vendor work starts.
 * See docs/ARCHITECTURE.md for how to wire this in.
 */
@Injectable()
export class ToastPOSAdapter implements SalesSource {
  async listLocations(): Promise<Location[]> {
    throw new Error("not implemented — Toast");
  }
  async getLocation(_id: string): Promise<Location | undefined> {
    throw new Error("not implemented — Toast");
  }
  async latestDate(_locationId: string): Promise<string> {
    throw new Error("not implemented — Toast");
  }
  async getSalesDays(_q: SalesQuery): Promise<SalesDay[]> {
    // TODO: wire real Toast Orders API, restaurant GUID + management group auth
    throw new Error("not implemented — Toast");
  }
  async getMenu(_locationId: string, _outletId?: string): Promise<MenuItem[]> {
    // TODO: wire real Toast Menus API
    throw new Error("not implemented — Toast");
  }
  async getItemSales(_q: SalesQuery): Promise<ItemSales[]> {
    // TODO: wire real Toast Orders API, line-item breakdown
    throw new Error("not implemented — Toast");
  }
}
