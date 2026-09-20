import { Injectable } from "@nestjs/common";
import type { SalesQuery, SalesSource } from "@evolv/contracts/ports";
import type { ItemSales, Location, MenuItem, SalesDay } from "@evolv/contracts/types";
import { isWithin } from "@evolv/contracts/dates";
import { aggregateItemSales, aggregateSalesDays } from "@evolv/contracts/sales";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

@Injectable()
export class MockSalesSource implements SalesSource {
  constructor(private readonly fixtures: FixturesService) {}

  async listLocations(): Promise<Location[]> {
    return latency(this.fixtures.locations, 40);
  }
  async getLocation(id: string): Promise<Location | undefined> {
    return latency(this.fixtures.locations.find((l) => l.id === id), 20);
  }
  async latestDate(): Promise<string> {
    return latency(this.fixtures.meta.asOf, 10);
  }
  async getSalesDays(q: SalesQuery): Promise<SalesDay[]> {
    const rows = this.fixtures.sales.filter(
      (d) => d.locationId === q.locationId && (q.outletId ? d.outletId === q.outletId : true) && isWithin(d.date, q.range),
    );
    return latency(aggregateSalesDays(rows, q.locationId).map((d) => ({ ...d, outletId: q.outletId })));
  }
  async getMenu(locationId: string, outletId?: string): Promise<MenuItem[]> {
    const items = this.fixtures.menus
      .filter((m) => m.locationId === locationId && (outletId ? m.outletId === outletId : true))
      .flatMap((m) => m.items);
    return latency(items, 30);
  }
  async getItemSales(q: SalesQuery): Promise<ItemSales[]> {
    const menu = new Map(this.fixtures.menus.flatMap((m) => m.items).map((m) => [m.id, m]));
    const dates = this.fixtures.meta.dates;
    const rows: ItemSales[] = [];
    for (const s of this.fixtures.itemSeries) {
      if (s.locationId !== q.locationId) continue;
      if (q.outletId && s.outletId !== q.outletId) continue;
      const m = menu.get(s.itemId);
      if (!m) continue;
      s.qty.forEach((qty, i) => {
        const date = dates[i];
        if (!qty || !isWithin(date, q.range)) return;
        rows.push({ locationId: s.locationId, outletId: s.outletId, date, itemId: s.itemId, name: m.name, category: m.category, qty, netSales: Math.round(qty * m.price * 100) / 100 });
      });
    }
    return latency(aggregateItemSales(rows, q.locationId));
  }
}
