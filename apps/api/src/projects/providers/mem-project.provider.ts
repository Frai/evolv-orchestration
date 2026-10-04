import { Injectable } from "@nestjs/common";
import type { CostDayQuery, ProjectSource } from "@evolv/contracts/ports";
import type { Company, CostCode, CostDay, Job } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemProjectSource implements ProjectSource {
  constructor(private readonly store: StoreService) {}

  async listCompanies(): Promise<Company[]> {
    return [...this.store.fx.companies].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCompany(id: string): Promise<Company | undefined> {
    return this.store.fx.companies.find((c) => c.id === id);
  }

  async latestDate(companyId: string): Promise<string> {
    const jobIds = new Set((await this.listJobs(companyId)).map((j) => j.id));
    let latest = "";
    for (const d of this.store.fx.costDays) if (jobIds.has(d.jobId) && d.date > latest) latest = d.date;
    if (!latest) throw new Error(`No cost data for company ${companyId}`);
    return latest;
  }

  async listJobs(companyId: string): Promise<Job[]> {
    return this.store.fx.jobs.filter((j) => j.companyId === companyId).sort((a, b) => b.contractValue - a.contractValue);
  }

  async getCostCodes(companyId: string, jobId?: string): Promise<CostCode[]> {
    const jobIds = new Set((await this.listJobs(companyId)).map((j) => j.id));
    return this.store.fx.codes.filter((c) => jobIds.has(c.jobId) && (!jobId || c.jobId === jobId));
  }

  async getCostDays(q: CostDayQuery): Promise<CostDay[]> {
    const jobIds = new Set((await this.listJobs(q.companyId)).map((j) => j.id));
    return this.store.fx.costDays.filter((d) => jobIds.has(d.jobId) && (!q.jobId || d.jobId === q.jobId) && d.date >= q.range.from && d.date <= q.range.to);
  }
}
