import { Injectable } from "@nestjs/common";
import type { AccountingSource, CostSummary } from "@evolv/contracts/ports";
import type { DateRange } from "@evolv/contracts/types";
import { isWithin } from "@evolv/contracts/dates";
import { aggregateSalesDays } from "@evolv/contracts/sales";
import { aggregateLabourDays } from "@evolv/contracts/labour";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

/** Derives a cost summary from the sales and labour fixtures. Food cost is a fixed 31% until an accounting system is connected. */
@Injectable()
export class MockAccountingSource implements AccountingSource {
  constructor(private readonly fixtures: FixturesService) {}

  async getCostSummary(locationId: string, range: DateRange): Promise<CostSummary> {
    const sales = aggregateSalesDays(this.fixtures.sales.filter((d) => d.locationId === locationId && isWithin(d.date, range)), locationId);
    const labour = aggregateLabourDays(this.fixtures.labour.filter((d) => d.locationId === locationId && isWithin(d.date, range)), locationId);
    const netSales = sales.reduce((a, d) => a + d.netSales, 0);
    return latency({
      locationId,
      range,
      netSales,
      cogs: Math.round(netSales * 0.31),
      labour: Math.round(labour.reduce((a, d) => a + d.labourCost, 0)),
      fixed: Math.round((sales.length / 30) * 9800),
    });
  }
}
