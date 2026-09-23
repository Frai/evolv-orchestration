import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { Approval } from "@evolv/contracts/types";
import { PG_POOL, type Executor } from "../db/pg-pool.provider";

interface ApprovalRow {
  id: string;
  location_id: string;
  agent_id: string;
  run_id: string | null;
  title: string;
  summary: string;
  amount: string | null;
  item_id: string | null;
  evidence: Approval["evidence"];
  status: Approval["status"];
  proposed_at: string;
  resolved_at: string | null;
  confirmation: string;
  action: string;
}
const mapRow = (r: ApprovalRow): Approval => ({
  id: r.id,
  locationId: r.location_id,
  agentId: r.agent_id,
  runId: r.run_id ?? undefined,
  title: r.title,
  summary: r.summary,
  amount: r.amount === null ? undefined : Number(r.amount),
  itemId: r.item_id ?? undefined,
  evidence: r.evidence,
  status: r.status,
  proposedAt: r.proposed_at,
  resolvedAt: r.resolved_at ?? undefined,
  confirmation: r.confirmation,
  action: r.action,
});

/** Replaces the old process-memory ApprovalStoreService. */
@Injectable()
export class ApprovalRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(locationId: string): Promise<Approval[]> {
    const { rows } = await this.pool.query<ApprovalRow>(`select * from approvals where location_id = $1 order by proposed_at desc`, [locationId]);
    return rows.map(mapRow);
  }

  async get(id: string, executor: Executor = this.pool): Promise<Approval | undefined> {
    const { rows } = await executor.query<ApprovalRow>(`select * from approvals where id = $1`, [id]);
    return rows[0] ? mapRow(rows[0]) : undefined;
  }

  async update(id: string, patch: Partial<Pick<Approval, "status" | "resolvedAt" | "action" | "confirmation">>, executor: Executor = this.pool): Promise<Approval> {
    const { rows } = await executor.query<ApprovalRow>(
      `update approvals set status = coalesce($2, status), resolved_at = coalesce($3, resolved_at), action = coalesce($4, action), confirmation = coalesce($5, confirmation)
       where id = $1 returning *`,
      [id, patch.status ?? null, patch.resolvedAt ?? null, patch.action ?? null, patch.confirmation ?? null],
    );
    if (!rows[0]) throw new Error(`Approval ${id} not found`);
    return mapRow(rows[0]);
  }
}
