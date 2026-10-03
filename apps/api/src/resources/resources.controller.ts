import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { ResourceSource } from "@evolv/contracts/ports";
import { RESOURCE_SOURCE } from "./resource-source.token";

@Controller("resources")
export class ResourcesController {
  constructor(@Inject(RESOURCE_SOURCE) private readonly source: ResourceSource) {}

  @Get("equipment")
  getEquipment(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined) {
    return this.source.getEquipment(companyId, jobId);
  }

  @Get("commitments")
  getCommitments(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined) {
    return this.source.getCommitments(companyId, jobId);
  }
}
