import { Module } from "@nestjs/common";
import { PurchaseOrdersController } from "./purchase-orders.controller";
import { PurchaseOrderRepository } from "./purchase-order.repository";

@Module({
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrderRepository],
  exports: [PurchaseOrderRepository],
})
export class PurchaseOrdersModule {}
