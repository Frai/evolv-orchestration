import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { StockLevel } from "@evolv/contracts/types";
import { PG_POOL, type Executor } from "../db/pg-pool.provider";

interface StockRow {
  location_id: string;
  item_id: string;
  name: string;
  category: string;
  unit: string;
  par: string;
  daily_usage: string;
  unit_cost: string;
  supplier: string;
  on_hand: string;
  counted_at: string;
}
const mapStock = (r: StockRow): StockLevel => ({
  locationId: r.location_id,
  itemId: r.item_id,
  name: r.name,
  category: r.category,
  unit: r.unit,
  onHand: Number(r.on_hand),
  par: Number(r.par),
  dailyUsage: Number(r.daily_usage),
  unitCost: Number(r.unit_cost),
  supplier: r.supplier,
  countedAt: r.counted_at,
});

const SELECT = `
  select si.location_id, si.item_id, si.name, si.category, si.unit, si.par, si.daily_usage, si.unit_cost, si.supplier,
         sl.on_hand, sl.counted_at
  from stock_items si
  join stock_levels sl on sl.location_id = si.location_id and sl.item_id = si.item_id
`;

/** Replaces the old process-memory StockStoreService — real persistence for the mutable half of stock. */
@Injectable()
export class StockRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(locationId: string): Promise<StockLevel[]> {
    const { rows } = await this.pool.query<StockRow>(`${SELECT} where si.location_id = $1`, [locationId]);
    return rows.map(mapStock);
  }

  async find(locationId: string, itemId: string, executor: Executor = this.pool): Promise<StockLevel | undefined> {
    const { rows } = await executor.query<StockRow>(`${SELECT} where si.location_id = $1 and si.item_id = $2`, [locationId, itemId]);
    return rows[0] ? mapStock(rows[0]) : undefined;
  }

  async setOnHand(locationId: string, itemId: string, onHand: number, executor: Executor = this.pool): Promise<StockLevel> {
    const countedAt = new Date().toISOString();
    const { rowCount } = await executor.query(
      `update stock_levels set on_hand = $3, counted_at = $4 where location_id = $1 and item_id = $2`,
      [locationId, itemId, onHand, countedAt],
    );
    if (!rowCount) throw new Error(`Stock item ${itemId} not found for ${locationId}`);
    const item = await this.find(locationId, itemId, executor);
    if (!item) throw new Error(`Stock item ${itemId} not found for ${locationId}`);
    return item;
  }
}
