import type { DateRange } from "@/core/types";

export interface CostSummary {
  locationId: string;
  range: DateRange;
  netSales: number;
  cogs: number;
  labour: number;
  /** Rent, utilities, insurance, etc. */
  fixed: number;
}

export interface AccountingSource {
  getCostSummary(locationId: string, range: DateRange): Promise<CostSummary>;
}
