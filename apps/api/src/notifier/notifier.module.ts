import { Module } from "@nestjs/common";
import { NotifierController } from "./notifier.controller";
import { NOTIFIER } from "./notifier.token";
import { PgNotifier } from "./providers/pg-notifier.provider";

@Module({
  controllers: [NotifierController],
  providers: [{ provide: NOTIFIER, useClass: PgNotifier }],
  exports: [NOTIFIER],
})
export class NotifierModule {}
