import type { LabourQuery, LabourSource } from "@/ports/LabourSource";
import type { LabourDay } from "@/core/types";
import { isWithin } from "@/core/dates";
import { aggregateLabourDays } from "@/core/labour";
import { fixtures, latency } from "./data";

export class MockLabourSource implements LabourSource {
  async getLabourDays(q: LabourQuery): Promise<LabourDay[]> {
    const rows = fixtures.labour.filter(
      (d) => d.locationId === q.locationId && (q.outletId ? d.outletId === q.outletId : true) && isWithin(d.date, q.range),
    );
    return latency(aggregateLabourDays(rows, q.locationId).map((d) => ({ ...d, outletId: q.outletId })));
  }
}
