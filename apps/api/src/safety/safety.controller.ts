import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { SafetySource } from "@evolv/contracts/ports";
import { SAFETY_SOURCE } from "./safety-source.token";

@Controller("safety")
export class SafetyController {
  constructor(@Inject(SAFETY_SOURCE) private readonly source: SafetySource) {}

  @Get("events")
  getSafetyEvents(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined) {
    return this.source.getSafetyEvents(companyId, jobId);
  }
}
