import type { StockLevel } from "@/core/types";

export interface InventorySource {
  getStockLevels(locationId: string): Promise<StockLevel[]>;
}
