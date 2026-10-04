import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { BillingSource } from "@evolv/contracts/ports";
import { BILLING_SOURCE } from "./billing-source.token";

@Controller("billing")
export class BillingController {
  constructor(@Inject(BILLING_SOURCE) private readonly source: BillingSource) {}

  @Get("tickets")
  getFieldTickets(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined) {
    return this.source.getFieldTickets(companyId, jobId);
  }

  @Get("invoices")
  getInvoices(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined) {
    return this.source.getInvoices(companyId, jobId);
  }

  @Get("change-orders")
  getChangeOrders(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined) {
    return this.source.getChangeOrders(companyId, jobId);
  }
}
