import { Module } from "@nestjs/common";
import { NotifierController } from "./notifier.controller";
import { NOTIFIER } from "./notifier.token";
import { MemNotifier } from "./providers/mem-notifier.provider";

@Module({
  controllers: [NotifierController],
  providers: [{ provide: NOTIFIER, useClass: MemNotifier }],
  exports: [NOTIFIER],
})
export class NotifierModule {}
