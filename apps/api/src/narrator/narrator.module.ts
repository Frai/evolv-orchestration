import { Module } from "@nestjs/common";
import { NarratorController } from "./narrator.controller";
import { NARRATOR } from "./narrator.token";
import { PgNarrator } from "./providers/pg-narrator.provider";

@Module({
  controllers: [NarratorController],
  providers: [{ provide: NARRATOR, useClass: PgNarrator }],
  exports: [NARRATOR],
})
export class NarratorModule {}
