import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { NotifierController } from "./notifier.controller";
import { NOTIFIER } from "./notifier.token";
import { MockNotifier } from "./providers/mock-notifier.provider";

@Module({
  imports: [FixturesModule],
  controllers: [NotifierController],
  providers: [{ provide: NOTIFIER, useClass: MockNotifier }],
  exports: [NOTIFIER],
})
export class NotifierModule {}
