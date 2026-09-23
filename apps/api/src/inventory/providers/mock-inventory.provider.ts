import { Injectable } from "@nestjs/common";
import type { InventorySource } from "@evolv/contracts/ports";
import type { StockLevel } from "@evolv/contracts/types";
import { latency } from "../../fixtures/fixtures.service";
import { StockStoreService } from "../stock-store.service";

@Injectable()
export class MockInventorySource implements InventorySource {
  constructor(private readonly stock: StockStoreService) {}

  async getStockLevels(locationId: string): Promise<StockLevel[]> {
    return latency(this.stock.list(locationId));
  }
}
