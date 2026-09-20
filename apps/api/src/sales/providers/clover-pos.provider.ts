import { Injectable } from "@nestjs/common";
import type { SalesQuery, SalesSource } from "@evolv/contracts/ports";
import type { ItemSales, Location, MenuItem, SalesDay } from "@evolv/contracts/types";

/**
 * Stub for a real Clover POS integration. Not wired into SalesModule yet —
 * present so the shape of a real adapter is visible before any vendor work starts.
 * See docs/ARCHITECTURE.md for how to wire this in.
 */
@Injectable()
export class CloverPOSAdapter implements SalesSource {
  async listLocations(): Promise<Location[]> {
    throw new Error("not implemented — Clover");
  }
  async getLocation(_id: string): Promise<Location | undefined> {
    throw new Error("not implemented — Clover");
  }
  async latestDate(_locationId: string): Promise<string> {
    throw new Error("not implemented — Clover");
  }
  async getSalesDays(_q: SalesQuery): Promise<SalesDay[]> {
    // TODO: wire real Clover Orders API, merchant ID + OAuth
    throw new Error("not implemented — Clover");
  }
  async getMenu(_locationId: string, _outletId?: string): Promise<MenuItem[]> {
    // TODO: wire real Clover Inventory API
    throw new Error("not implemented — Clover");
  }
  async getItemSales(_q: SalesQuery): Promise<ItemSales[]> {
    // TODO: wire real Clover order line-item API
    throw new Error("not implemented — Clover");
  }
}
