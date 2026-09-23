import { Controller, Get, Query } from "@nestjs/common";
import { PurchaseOrderLedgerService } from "./purchase-order-ledger.service";

@Controller("purchase-orders")
export class PurchaseOrdersController {
  constructor(private readonly ledger: PurchaseOrderLedgerService) {}

  @Get()
  list(@Query("locationId") locationId: string) {
    return this.ledger.list(locationId);
  }
}
