import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { SalesQuery, SalesSource } from "@evolv/contracts/ports";
import type { ItemSales, Location, MenuItem, SalesDay } from "@evolv/contracts/types";
import { aggregateItemSales, aggregateSalesDays } from "@evolv/contracts/sales";
import { PG_POOL } from "../../db/pg-pool.provider";
import { getLocationById, listLocations } from "../../locations/location-rows";

interface SalesDayRow {
  location_id: string;
  outlet_id: string | null;
  date: string;
  net_sales: string;
  tax: string;
  tips: string;
  covers: number;
  orders: number;
  hourly: number[];
  hourly_orders: number[];
  channels: SalesDay["channels"];
  last_year_net_sales: string;
}

@Injectable()
export class PgSalesSource implements SalesSource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listLocations(): Promise<Location[]> {
    return listLocations(this.pool);
  }

  async getLocation(id: string): Promise<Location | undefined> {
    return getLocationById(this.pool, id);
  }

  async latestDate(locationId: string): Promise<string> {
    const { rows } = await this.pool.query<{ latest: string | null }>(
      `select to_char(max(date), 'YYYY-MM-DD') as latest from sales_days where location_id = $1`,
      [locationId],
    );
    return rows[0]?.latest ?? new Date().toISOString().slice(0, 10);
  }

  async getSalesDays(q: SalesQuery): Promise<SalesDay[]> {
    const { rows } = await this.pool.query<SalesDayRow>(
      `select location_id, outlet_id, to_char(date, 'YYYY-MM-DD') as date, net_sales, tax, tips, covers, orders, hourly, hourly_orders, channels, last_year_net_sales
       from sales_days
       where location_id = $1 and ($2::text is null or outlet_id = $2) and date between $3 and $4`,
      [q.locationId, q.outletId ?? null, q.range.from, q.range.to],
    );
    const days: SalesDay[] = rows.map(mapSalesDayRow);
    return aggregateSalesDays(days, q.locationId).map((d) => ({ ...d, outletId: q.outletId }));
  }

  async getMenu(locationId: string, outletId?: string): Promise<MenuItem[]> {
    const { rows } = await this.pool.query<{ item_id: string; name: string; category: string; price: string }>(
      `select item_id, name, category, price from menu_items where location_id = $1 and ($2::text is null or outlet_id = $2)`,
      [locationId, outletId ?? null],
    );
    return rows.map((r) => ({ id: r.item_id, name: r.name, category: r.category, price: Number(r.price) }));
  }

  async getItemSales(q: SalesQuery): Promise<ItemSales[]> {
    const { rows: seriesRows } = await this.pool.query<{ location_id: string; outlet_id: string | null; item_id: string; qty: number[] }>(
      `select location_id, outlet_id, item_id, qty from item_sales_series where location_id = $1 and ($2::text is null or outlet_id = $2)`,
      [q.locationId, q.outletId ?? null],
    );
    const { rows: menuRows } = await this.pool.query<{ item_id: string; name: string; category: string; price: string }>(
      `select item_id, name, category, price from menu_items where location_id = $1`,
      [q.locationId],
    );
    const menu = new Map(menuRows.map((m) => [m.item_id, { name: m.name, category: m.category, price: Number(m.price) }]));

    const { rows: dateRows } = await this.pool.query<{ date: string }>(
      `select distinct to_char(date, 'YYYY-MM-DD') as date from sales_days where location_id = $1 order by date`,
      [q.locationId],
    );
    const dates = dateRows.map((r) => r.date);

    const out: ItemSales[] = [];
    for (const s of seriesRows) {
      const m = menu.get(s.item_id);
      if (!m) continue;
      s.qty.forEach((qty, i) => {
        const date = dates[i];
        if (!qty || !date || date < q.range.from || date > q.range.to) return;
        out.push({
          locationId: s.location_id,
          outletId: s.outlet_id ?? undefined,
          date,
          itemId: s.item_id,
          name: m.name,
          category: m.category,
          qty,
          netSales: Math.round(qty * m.price * 100) / 100,
        });
      });
    }
    return aggregateItemSales(out, q.locationId);
  }
}

function mapSalesDayRow(r: SalesDayRow): SalesDay {
  return {
    locationId: r.location_id,
    outletId: r.outlet_id ?? undefined,
    date: r.date,
    netSales: Number(r.net_sales),
    tax: Number(r.tax),
    tips: Number(r.tips),
    covers: r.covers,
    orders: r.orders,
    hourly: r.hourly,
    hourlyOrders: r.hourly_orders,
    channels: r.channels,
    lastYearNetSales: Number(r.last_year_net_sales),
  };
}
