import { Module } from "@nestjs/common";
import { SafetyController } from "./safety.controller";
import { SAFETY_SOURCE } from "./safety-source.token";
import { MemSafetySource } from "./providers/mem-safety.provider";

@Module({
  controllers: [SafetyController],
  providers: [{ provide: SAFETY_SOURCE, useClass: MemSafetySource }],
  exports: [SAFETY_SOURCE],
})
export class SafetyModule {}
