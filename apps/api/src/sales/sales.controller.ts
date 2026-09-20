import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import type { SalesSource } from "@evolv/contracts/ports";
import { SALES_SOURCE } from "./sales-source.token";

@Controller("sales")
export class SalesController {
  constructor(@Inject(SALES_SOURCE) private readonly source: SalesSource) {}

  @Get("locations")
  listLocations() {
    return this.source.listLocations();
  }

  @Get("locations/:id")
  getLocation(@Param("id") id: string) {
    return this.source.getLocation(id);
  }

  @Get("locations/:id/latest-date")
  latestDate(@Param("id") id: string) {
    return this.source.latestDate(id);
  }

  @Get("days")
  getSalesDays(@Query("locationId") locationId: string, @Query("outletId") outletId: string | undefined, @Query("from") from: string, @Query("to") to: string) {
    return this.source.getSalesDays({ locationId, outletId, range: { from, to } });
  }

  @Get("menu")
  getMenu(@Query("locationId") locationId: string, @Query("outletId") outletId: string | undefined) {
    return this.source.getMenu(locationId, outletId);
  }

  @Get("item-sales")
  getItemSales(@Query("locationId") locationId: string, @Query("outletId") outletId: string | undefined, @Query("from") from: string, @Query("to") to: string) {
    return this.source.getItemSales({ locationId, outletId, range: { from, to } });
  }
}
