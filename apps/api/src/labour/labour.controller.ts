import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { LabourSource } from "@evolv/contracts/ports";
import { LABOUR_SOURCE } from "./labour-source.token";

@Controller("labour")
export class LabourController {
  constructor(@Inject(LABOUR_SOURCE) private readonly source: LabourSource) {}

  @Get("days")
  getLabourDays(@Query("locationId") locationId: string, @Query("outletId") outletId: string | undefined, @Query("from") from: string, @Query("to") to: string) {
    return this.source.getLabourDays({ locationId, outletId, range: { from, to } });
  }
}
