import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { SalesController } from "./sales.controller";
import { SALES_SOURCE } from "./sales-source.token";
import { MockSalesSource } from "./providers/mock-sales.provider";

@Module({
  imports: [FixturesModule],
  controllers: [SalesController],
  providers: [{ provide: SALES_SOURCE, useClass: MockSalesSource }],
  exports: [SALES_SOURCE],
})
export class SalesModule {}
