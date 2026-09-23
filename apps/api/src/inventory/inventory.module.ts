import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { InventoryController } from "./inventory.controller";
import { INVENTORY_SOURCE } from "./inventory-source.token";
import { MockInventorySource } from "./providers/mock-inventory.provider";
import { StockStoreService } from "./stock-store.service";

@Module({
  imports: [FixturesModule],
  controllers: [InventoryController],
  providers: [StockStoreService, { provide: INVENTORY_SOURCE, useClass: MockInventorySource }],
  exports: [INVENTORY_SOURCE, StockStoreService],
})
export class InventoryModule {}
