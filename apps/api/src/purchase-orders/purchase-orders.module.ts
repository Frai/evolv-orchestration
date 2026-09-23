import { Module } from "@nestjs/common";
import { PurchaseOrdersController } from "./purchase-orders.controller";
import { PurchaseOrderLedgerService } from "./purchase-order-ledger.service";

@Module({
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrderLedgerService],
  exports: [PurchaseOrderLedgerService],
})
export class PurchaseOrdersModule {}
