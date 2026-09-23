import { Module } from "@nestjs/common";
import { InventoryController } from "./inventory.controller";
import { INVENTORY_SOURCE } from "./inventory-source.token";
import { PgInventorySource } from "./providers/pg-inventory.provider";
import { StockRepository } from "./stock.repository";

@Module({
  controllers: [InventoryController],
  providers: [StockRepository, { provide: INVENTORY_SOURCE, useClass: PgInventorySource }],
  exports: [INVENTORY_SOURCE, StockRepository],
})
export class InventoryModule {}
