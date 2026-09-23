import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { LabourQuery, LabourSource } from "@evolv/contracts/ports";
import type { LabourDay } from "@evolv/contracts/types";
import { aggregateLabourDays } from "@evolv/contracts/labour";
import { PG_POOL } from "../../db/pg-pool.provider";

interface LabourDayRow {
  location_id: string;
  outlet_id: string | null;
  date: string;
  scheduled_hours: string;
  actual_hours: string;
  labour_cost: string;
  shifts: LabourDay["shifts"];
}

@Injectable()
export class PgLabourSource implements LabourSource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getLabourDays(q: LabourQuery): Promise<LabourDay[]> {
    const { rows } = await this.pool.query<LabourDayRow>(
      `select location_id, outlet_id, to_char(date, 'YYYY-MM-DD') as date, scheduled_hours, actual_hours, labour_cost, shifts
       from labour_days
       where location_id = $1 and ($2::text is null or outlet_id = $2) and date between $3 and $4`,
      [q.locationId, q.outletId ?? null, q.range.from, q.range.to],
    );
    const days: LabourDay[] = rows.map((r) => ({
      locationId: r.location_id,
      outletId: r.outlet_id ?? undefined,
      date: r.date,
      scheduledHours: Number(r.scheduled_hours),
      actualHours: Number(r.actual_hours),
      labourCost: Number(r.labour_cost),
      shifts: r.shifts,
    }));
    return aggregateLabourDays(days, q.locationId).map((d) => ({ ...d, outletId: q.outletId }));
  }
}
