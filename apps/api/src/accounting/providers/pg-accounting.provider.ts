import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { AccountingSource, CostSummary } from "@evolv/contracts/ports";
import type { DateRange } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";

/** Food cost is a fixed 31% until an accounting system is connected — same heuristic as before, just fed by real rows. */
@Injectable()
export class PgAccountingSource implements AccountingSource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getCostSummary(locationId: string, range: DateRange): Promise<CostSummary> {
    const [salesResult, labourResult] = await Promise.all([
      this.pool.query<{ total: string | null; days: string }>(
        `select sum(net_sales) as total, count(distinct date) as days from sales_days where location_id = $1 and date between $2 and $3`,
        [locationId, range.from, range.to],
      ),
      this.pool.query<{ total: string | null }>(
        `select sum(labour_cost) as total from labour_days where location_id = $1 and date between $2 and $3`,
        [locationId, range.from, range.to],
      ),
    ]);
    const netSales = Number(salesResult.rows[0]?.total ?? 0);
    const labour = Math.round(Number(labourResult.rows[0]?.total ?? 0));
    const days = Number(salesResult.rows[0]?.days ?? 0);

    return {
      locationId,
      range,
      netSales,
      cogs: Math.round(netSales * 0.31),
      labour,
      fixed: Math.round((days / 30) * 9800),
    };
  }
}
