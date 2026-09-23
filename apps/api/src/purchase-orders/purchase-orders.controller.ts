import { Controller, Get, Query } from "@nestjs/common";
import { PurchaseOrderRepository } from "./purchase-order.repository";

@Controller("purchase-orders")
export class PurchaseOrdersController {
  constructor(private readonly ledger: PurchaseOrderRepository) {}

  @Get()
  list(@Query("locationId") locationId: string) {
    return this.ledger.list(locationId);
  }
}
