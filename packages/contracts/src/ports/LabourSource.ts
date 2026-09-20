import type { DateRange, LabourDay } from "../domain";

export interface LabourQuery {
  locationId: string;
  outletId?: string;
  range: DateRange;
}

export interface LabourSource {
  getLabourDays(q: LabourQuery): Promise<LabourDay[]>;
}
