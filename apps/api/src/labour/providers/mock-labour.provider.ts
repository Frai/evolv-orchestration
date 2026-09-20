import { Injectable } from "@nestjs/common";
import type { LabourQuery, LabourSource } from "@evolv/contracts/ports";
import type { LabourDay } from "@evolv/contracts/types";
import { isWithin } from "@evolv/contracts/dates";
import { aggregateLabourDays } from "@evolv/contracts/labour";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

@Injectable()
export class MockLabourSource implements LabourSource {
  constructor(private readonly fixtures: FixturesService) {}

  async getLabourDays(q: LabourQuery): Promise<LabourDay[]> {
    const rows = this.fixtures.labour.filter(
      (d) => d.locationId === q.locationId && (q.outletId ? d.outletId === q.outletId : true) && isWithin(d.date, q.range),
    );
    return latency(aggregateLabourDays(rows, q.locationId).map((d) => ({ ...d, outletId: q.outletId })));
  }
}
