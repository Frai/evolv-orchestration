import { Module } from "@nestjs/common";
import { BillingController } from "./billing.controller";
import { BILLING_SOURCE } from "./billing-source.token";
import { MemBillingSource } from "./providers/mem-billing.provider";
import { ChangeOrderRepository } from "./change-order.repository";

@Module({
  controllers: [BillingController],
  providers: [ChangeOrderRepository, { provide: BILLING_SOURCE, useClass: MemBillingSource }],
  exports: [BILLING_SOURCE, ChangeOrderRepository],
})
export class BillingModule {}
