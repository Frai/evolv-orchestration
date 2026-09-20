import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { InventorySource } from "@evolv/contracts/ports";
import { INVENTORY_SOURCE } from "./inventory-source.token";

@Controller("inventory")
export class InventoryController {
  constructor(@Inject(INVENTORY_SOURCE) private readonly source: InventorySource) {}

  @Get("stock")
  getStockLevels(@Query("locationId") locationId: string) {
    return this.source.getStockLevels(locationId);
  }
}
