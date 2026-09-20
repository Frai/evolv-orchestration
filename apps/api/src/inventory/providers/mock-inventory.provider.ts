import { Injectable } from "@nestjs/common";
import type { InventorySource } from "@evolv/contracts/ports";
import type { StockLevel } from "@evolv/contracts/types";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

@Injectable()
export class MockInventorySource implements InventorySource {
  constructor(private readonly fixtures: FixturesService) {}

  async getStockLevels(locationId: string): Promise<StockLevel[]> {
    return latency(this.fixtures.stock.filter((s) => s.locationId === locationId));
  }
}
