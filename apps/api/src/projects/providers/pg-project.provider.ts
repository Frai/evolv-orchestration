import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { CostDayQuery, ProjectSource } from "@evolv/contracts/ports";
import type { Company, CostCode, CostDay, Job } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";

interface CompanyRow {
  id: string;
  name: string;
  short_name: string;
  segment: Company["segment"];
  accounting: Company["accounting"];
  city: string;
  currency: string;
  employee_count: number;
  target_margin_pct: number;
  owner_name: string;
  owner_role: string;
  owner_phone: string;
  owner_email: string;
}
const mapCompany = (r: CompanyRow): Company => ({
  id: r.id,
  name: r.name,
  shortName: r.short_name,
  segment: r.segment,
  accounting: r.accounting,
  city: r.city,
  currency: r.currency as Company["currency"],
  employeeCount: r.employee_count,
  targetMarginPct: r.target_margin_pct,
  owner: { name: r.owner_name, role: r.owner_role, phone: r.owner_phone, email: r.owner_email },
});

interface JobRow {
  id: string;
  company_id: string;
  name: string;
  client: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  status: Job["status"];
  pm: string;
}
const mapJob = (r: JobRow): Job => ({
  id: r.id,
  companyId: r.company_id,
  name: r.name,
  client: r.client,
  contractValue: r.contract_value,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  pm: r.pm,
});

interface CodeRow {
  id: string;
  job_id: string;
  code: string;
  name: string;
  category: CostCode["category"];
  budget: number;
  planned_qty: number;
  unit: string;
  planned_start: string;
  planned_end: string;
  extra: boolean;
}
const mapCode = (r: CodeRow): CostCode => ({
  id: r.id,
  jobId: r.job_id,
  code: r.code,
  name: r.name,
  category: r.category,
  budget: r.budget,
  plannedQty: r.planned_qty,
  unit: r.unit,
  plannedStart: r.planned_start,
  plannedEnd: r.planned_end,
  extra: r.extra || undefined,
});

@Injectable()
export class PgProjectSource implements ProjectSource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listCompanies(): Promise<Company[]> {
    const { rows } = await this.pool.query<CompanyRow>(`select * from companies order by name`);
    return rows.map(mapCompany);
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const { rows } = await this.pool.query<CompanyRow>(`select * from companies where id = $1`, [id]);
    return rows[0] ? mapCompany(rows[0]) : undefined;
  }

  async latestDate(companyId: string): Promise<string> {
    const { rows } = await this.pool.query<{ latest: string | null }>(
      `select max(d.date) as latest from cost_days d join jobs j on j.id = d.job_id where j.company_id = $1`,
      [companyId],
    );
    const latest = rows[0]?.latest;
    if (!latest) throw new Error(`No cost data for company ${companyId}`);
    return latest;
  }

  async listJobs(companyId: string): Promise<Job[]> {
    const { rows } = await this.pool.query<JobRow>(`select * from jobs where company_id = $1 order by contract_value desc`, [companyId]);
    return rows.map(mapJob);
  }

  async getCostCodes(companyId: string, jobId?: string): Promise<CostCode[]> {
    const { rows } = await this.pool.query<CodeRow>(
      `select c.* from cost_codes c join jobs j on j.id = c.job_id
       where j.company_id = $1 and ($2::text is null or c.job_id = $2) order by c.job_id, c.code`,
      [companyId, jobId ?? null],
    );
    return rows.map(mapCode);
  }

  async getCostDays(q: CostDayQuery): Promise<CostDay[]> {
    const { rows } = await this.pool.query<{ job_id: string; code_id: string; date: string; hours: number; overtime_hours: number; cost: number; qty: number }>(
      `select d.job_id, d.code_id, d.date, d.hours, d.overtime_hours, d.cost, d.qty
       from cost_days d join jobs j on j.id = d.job_id
       where j.company_id = $1 and ($2::text is null or d.job_id = $2) and d.date between $3 and $4
       order by d.date, d.job_id, d.code_id`,
      [q.companyId, q.jobId ?? null, q.range.from, q.range.to],
    );
    return rows.map((r) => ({ jobId: r.job_id, codeId: r.code_id, date: r.date, hours: r.hours, overtimeHours: r.overtime_hours, cost: r.cost, qty: r.qty }));
  }
}
