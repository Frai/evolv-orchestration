import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { ResourceSource } from "@evolv/contracts/ports";
import type { Commitment, Equipment } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";

@Injectable()
export class PgResourceSource implements ResourceSource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getEquipment(companyId: string, jobId?: string): Promise<Equipment[]> {
    const { rows } = await this.pool.query<{
      id: string; job_id: string; name: string; type: string; ownership: Equipment["ownership"]; daily_rate: number; usage_hours14: number[]; service_due_date: string | null;
    }>(
      `select e.* from equipment e join jobs j on j.id = e.job_id
       where j.company_id = $1 and ($2::text is null or e.job_id = $2) order by e.job_id, e.name`,
      [companyId, jobId ?? null],
    );
    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      name: r.name,
      type: r.type,
      ownership: r.ownership,
      dailyRate: r.daily_rate,
      usageHours14: r.usage_hours14,
      serviceDueDate: r.service_due_date ?? undefined,
    }));
  }

  async getCommitments(companyId: string, jobId?: string): Promise<Commitment[]> {
    const { rows } = await this.pool.query<{
      id: string; job_id: string; vendor: string; description: string; kind: Commitment["kind"]; committed: number; invoiced: number; promised_date: string; need_date: string; status: Commitment["status"];
    }>(
      `select c.* from commitments c join jobs j on j.id = c.job_id
       where j.company_id = $1 and ($2::text is null or c.job_id = $2) order by c.need_date`,
      [companyId, jobId ?? null],
    );
    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      vendor: r.vendor,
      description: r.description,
      kind: r.kind,
      committed: r.committed,
      invoiced: r.invoiced,
      promisedDate: r.promised_date,
      needDate: r.need_date,
      status: r.status,
    }));
  }
}
