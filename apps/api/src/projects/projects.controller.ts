import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import type { ProjectSource } from "@evolv/contracts/ports";
import { PROJECT_SOURCE } from "./projects-source.token";

@Controller("projects")
export class ProjectsController {
  constructor(@Inject(PROJECT_SOURCE) private readonly source: ProjectSource) {}

  @Get("companies")
  listCompanies() {
    return this.source.listCompanies();
  }

  @Get("companies/:id")
  getCompany(@Param("id") id: string) {
    return this.source.getCompany(id);
  }

  @Get("companies/:id/latest-date")
  latestDate(@Param("id") id: string) {
    return this.source.latestDate(id);
  }

  @Get("jobs")
  listJobs(@Query("companyId") companyId: string) {
    return this.source.listJobs(companyId);
  }

  @Get("cost-codes")
  getCostCodes(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined) {
    return this.source.getCostCodes(companyId, jobId);
  }

  @Get("cost-days")
  getCostDays(@Query("companyId") companyId: string, @Query("jobId") jobId: string | undefined, @Query("from") from: string, @Query("to") to: string) {
    return this.source.getCostDays({ companyId, jobId, range: { from, to } });
  }
}
