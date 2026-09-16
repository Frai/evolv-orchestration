import type { AccountingSource, CostSummary } from "@/ports/AccountingSource";
import type { DateRange } from "@/core/types";
import { isWithin } from "@/core/dates";
import { aggregateSalesDays } from "@/core/sales";
import { aggregateLabourDays } from "@/core/labour";
import { fixtures, latency } from "./data";

/** Derives a cost summary from the sales and labour fixtures. Food cost is a fixed 31% until an accounting system is connected. */
export class MockAccountingSource implements AccountingSource {
  async getCostSummary(locationId: string, range: DateRange): Promise<CostSummary> {
    const sales = aggregateSalesDays(fixtures.sales.filter((d) => d.locationId === locationId && isWithin(d.date, range)), locationId);
    const labour = aggregateLabourDays(fixtures.labour.filter((d) => d.locationId === locationId && isWithin(d.date, range)), locationId);
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
