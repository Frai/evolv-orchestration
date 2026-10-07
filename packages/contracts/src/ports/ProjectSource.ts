import type { Company, CostCode, CostDay, DateRange, Job } from "../domain";

export interface CostDayQuery {
  companyId: string;
  /** Omit to return every job's rows for the company. */
  jobId?: string;
  range: DateRange;
}

/** Estimate, job cost and field progress: what a contractor's accounting, estimating and timekeeping systems feed. */
export interface ProjectSource {
  listCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  /** The most recent closed business day available from the source. */
  latestDate(companyId: string): Promise<string>;
  listJobs(companyId: string): Promise<Job[]>;
  getCostCodes(companyId: string, jobId?: string): Promise<CostCode[]>;
  getCostDays(q: CostDayQuery): Promise<CostDay[]>;
}
