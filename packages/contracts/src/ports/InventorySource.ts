import type { StockLevel } from "../domain";

export interface InventorySource {
  getStockLevels(locationId: string): Promise<StockLevel[]>;
}
