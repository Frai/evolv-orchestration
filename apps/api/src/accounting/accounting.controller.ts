import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { AccountingSource } from "@evolv/contracts/ports";
import { ACCOUNTING_SOURCE } from "./accounting-source.token";

@Controller("accounting")
export class AccountingController {
  constructor(@Inject(ACCOUNTING_SOURCE) private readonly source: AccountingSource) {}

  @Get("cost-summary")
  getCostSummary(@Query("locationId") locationId: string, @Query("from") from: string, @Query("to") to: string) {
    return this.source.getCostSummary(locationId, { from, to });
  }
}
