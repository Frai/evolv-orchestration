import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { SafetySource } from "@evolv/contracts/ports";
import type { SafetyEvent } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";

@Injectable()
export class PgSafetySource implements SafetySource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getSafetyEvents(companyId: string, jobId?: string): Promise<SafetyEvent[]> {
    const { rows } = await this.pool.query<{
      id: string; job_id: string; kind: SafetyEvent["kind"]; date: string; title: string; owner: string; corrective_due: string; status: SafetyEvent["status"];
    }>(
      `select s.* from safety_events s join jobs j on j.id = s.job_id
       where j.company_id = $1 and ($2::text is null or s.job_id = $2) order by s.date desc`,
      [companyId, jobId ?? null],
    );
    return rows.map((r) => ({ id: r.id, jobId: r.job_id, kind: r.kind, date: r.date, title: r.title, owner: r.owner, correctiveDue: r.corrective_due, status: r.status }));
  }
}
