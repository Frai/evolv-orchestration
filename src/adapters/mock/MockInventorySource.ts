import type { InventorySource } from "@/ports/InventorySource";
import type { StockLevel } from "@/core/types";
import { fixtures, latency } from "./data";

export class MockInventorySource implements InventorySource {
  async getStockLevels(locationId: string): Promise<StockLevel[]> {
    return latency(fixtures.stock.filter((s) => s.locationId === locationId));
  }
}
