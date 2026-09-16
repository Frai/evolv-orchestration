import type { DateRange, LabourDay } from "@/core/types";

export interface LabourQuery {
  locationId: string;
  outletId?: string;
  range: DateRange;
}

export interface LabourSource {
  getLabourDays(q: LabourQuery): Promise<LabourDay[]>;
}
