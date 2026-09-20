import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { NarratorController } from "./narrator.controller";
import { NARRATOR } from "./narrator.token";
import { MockNarrator } from "./providers/mock-narrator.provider";

@Module({
  imports: [FixturesModule],
  controllers: [NarratorController],
  providers: [{ provide: NARRATOR, useClass: MockNarrator }],
  exports: [NARRATOR],
})
export class NarratorModule {}
