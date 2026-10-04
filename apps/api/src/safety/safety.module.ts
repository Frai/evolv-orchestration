import { Module } from "@nestjs/common";
import { SafetyController } from "./safety.controller";
import { SAFETY_SOURCE } from "./safety-source.token";
import { PgSafetySource } from "./providers/pg-safety.provider";

@Module({
  controllers: [SafetyController],
  providers: [{ provide: SAFETY_SOURCE, useClass: PgSafetySource }],
  exports: [SAFETY_SOURCE],
})
export class SafetyModule {}
