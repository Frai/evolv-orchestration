import { Module } from "@nestjs/common";
import { AccountingController } from "./accounting.controller";
import { ACCOUNTING_SOURCE } from "./accounting-source.token";
import { PgAccountingSource } from "./providers/pg-accounting.provider";

@Module({
  controllers: [AccountingController],
  providers: [{ provide: ACCOUNTING_SOURCE, useClass: PgAccountingSource }],
  exports: [ACCOUNTING_SOURCE],
})
export class AccountingModule {}
