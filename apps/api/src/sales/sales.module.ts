import { Module } from "@nestjs/common";
import { SalesController } from "./sales.controller";
import { SALES_SOURCE } from "./sales-source.token";
import { PgSalesSource } from "./providers/pg-sales.provider";

@Module({
  controllers: [SalesController],
  providers: [{ provide: SALES_SOURCE, useClass: PgSalesSource }],
  exports: [SALES_SOURCE],
})
export class SalesModule {}
