import { Module } from "@nestjs/common";
import { NarratorController } from "./narrator.controller";
import { NARRATOR } from "./narrator.token";
import { MemNarrator } from "./providers/mem-narrator.provider";

@Module({
  controllers: [NarratorController],
  providers: [{ provide: NARRATOR, useClass: MemNarrator }],
  exports: [NARRATOR],
})
export class NarratorModule {}
