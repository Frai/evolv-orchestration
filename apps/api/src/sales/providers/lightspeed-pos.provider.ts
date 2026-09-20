import { Injectable } from "@nestjs/common";
import type { SalesQuery, SalesSource } from "@evolv/contracts/ports";
import type { ItemSales, Location, MenuItem, SalesDay } from "@evolv/contracts/types";

/**
 * Stub for a real Lightspeed POS integration. Not wired into SalesModule yet —
 * present so the shape of a real adapter is visible before any vendor work starts.
 * See docs/ARCHITECTURE.md for how to wire this in.
 */
@Injectable()
export class LightspeedPOSAdapter implements SalesSource {
  async listLocations(): Promise<Location[]> {
    throw new Error("not implemented — Lightspeed");
  }
  async getLocation(_id: string): Promise<Location | undefined> {
    throw new Error("not implemented — Lightspeed");
  }
  async latestDate(_locationId: string): Promise<string> {
    throw new Error("not implemented — Lightspeed");
  }
  async getSalesDays(_q: SalesQuery): Promise<SalesDay[]> {
    // TODO: wire real Lightspeed Restaurant/eCom API
    throw new Error("not implemented — Lightspeed");
  }
  async getMenu(_locationId: string, _outletId?: string): Promise<MenuItem[]> {
    // TODO: wire real Lightspeed catalog/menu API
    throw new Error("not implemented — Lightspeed");
  }
  async getItemSales(_q: SalesQuery): Promise<ItemSales[]> {
    // TODO: wire real Lightspeed order line-item API
    throw new Error("not implemented — Lightspeed");
  }
}
