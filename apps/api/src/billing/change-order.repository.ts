import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { ChangeOrder } from "@evolv/contracts/types";
import { PG_POOL, type Executor } from "../db/pg-pool.provider";

export interface ChangeOrderRow {
  id: string;
  job_id: string;
  number: string;
  title: string;
  amount: number;
  status: ChangeOrder["status"];
  code_id: string | null;
  created_at: string;
  submitted_at: string | null;
}

export const mapChangeOrder = (r: ChangeOrderRow): ChangeOrder => ({
  id: r.id,
  jobId: r.job_id,
  number: r.number,
  title: r.title,
  amount: r.amount,
  status: r.status,
  codeId: r.code_id ?? undefined,
  createdAt: r.created_at,
  submittedAt: r.submitted_at ?? undefined,
});

export interface ExtraWorkCode {
  codeId: string;
  jobId: string;
  name: string;
  client: string;
}

export interface NewChangeOrder {
  jobId: string;
  codeId: string;
  title: string;
  amount: number;
}

/** The one real downstream write in this demo: approving a change-order draft inserts a row here. */
@Injectable()
export class ChangeOrderRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findExtraWorkCode(codeId: string, executor: Executor = this.pool): Promise<ExtraWorkCode | undefined> {
    const { rows } = await executor.query<{ id: string; job_id: string; name: string; client: string }>(
      `select c.id, c.job_id, c.name, j.client from cost_codes c join jobs j on j.id = c.job_id where c.id = $1`,
      [codeId],
    );
    const r = rows[0];
    return r ? { codeId: r.id, jobId: r.job_id, name: r.name, client: r.client } : undefined;
  }

  /** Creates the change order as pending (submitted to the client, not yet approved by them). */
  async create(input: NewChangeOrder, executor: Executor = this.pool): Promise<ChangeOrder> {
    const { rows: count } = await executor.query<{ n: number }>(`select count(*)::int as n from change_orders where job_id = $1`, [input.jobId]);
    const seq = (count[0]?.n ?? 0) + 1;
    const now = new Date().toISOString();
    const { rows } = await executor.query<ChangeOrderRow>(
      `insert into change_orders (id, job_id, number, title, amount, status, code_id, created_at, submitted_at)
       values ($1, $2, $3, $4, $5, 'pending', $6, $7, $7) returning *`,
      [`${input.jobId}:co-${seq}`, input.jobId, `CO-${String(seq).padStart(3, "0")}`, input.title, input.amount, input.codeId, now],
    );
    return mapChangeOrder(rows[0]);
  }
}
