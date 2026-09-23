import { Injectable } from "@nestjs/common";
import type { InventorySource } from "@evolv/contracts/ports";
import type { StockLevel } from "@evolv/contracts/types";
import { StockRepository } from "../stock.repository";

@Injectable()
export class PgInventorySource implements InventorySource {
  constructor(private readonly stock: StockRepository) {}

  async getStockLevels(locationId: string): Promise<StockLevel[]> {
    return this.stock.list(locationId);
  }
}
