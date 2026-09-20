import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { AccountingController } from "./accounting.controller";
import { ACCOUNTING_SOURCE } from "./accounting-source.token";
import { MockAccountingSource } from "./providers/mock-accounting.provider";

@Module({
  imports: [FixturesModule],
  controllers: [AccountingController],
  providers: [{ provide: ACCOUNTING_SOURCE, useClass: MockAccountingSource }],
  exports: [ACCOUNTING_SOURCE],
})
export class AccountingModule {}
