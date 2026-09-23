import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import { PG_POOL, type Executor } from "../db/pg-pool.provider";
import type { PurchaseOrder } from "./purchase-order.types";

interface PORow {
  id: string;
  location_id: string;
  approval_id: string;
  item_id: string;
  item_name: string;
  qty: string;
  unit: string;
  unit_cost: string;
  total_cost: string;
  supplier: string;
  created_at: string;
  status: PurchaseOrder["status"];
}
const mapRow = (r: PORow): PurchaseOrder => ({
  id: r.id,
  locationId: r.location_id,
  approvalId: r.approval_id,
  itemId: r.item_id,
  itemName: r.item_name,
  qty: Number(r.qty),
  unit: r.unit,
  unitCost: Number(r.unit_cost),
  totalCost: Number(r.total_cost),
  supplier: r.supplier,
  createdAt: r.created_at,
  status: r.status,
});

/**
 * Replaces the old process-memory PurchaseOrderLedgerService. In-memory before, now the
 * whole point: a purchase order created by approving an Inventory Guard reorder survives
 * a restart, same as the stock bump and approval decision it's committed alongside.
 */
@Injectable()
export class PurchaseOrderRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(po: Omit<PurchaseOrder, "id" | "createdAt" | "status">, executor: Executor = this.pool): Promise<PurchaseOrder> {
    const { rows: seqRows } = await executor.query<{ n: string }>(`select nextval('purchase_order_seq') as n`);
    const id = `po-${String(seqRows[0].n).padStart(4, "0")}`;
    const createdAt = new Date().toISOString();
    const { rows } = await executor.query<PORow>(
      `insert into purchase_orders (id, location_id, approval_id, item_id, item_name, qty, unit, unit_cost, total_cost, supplier, created_at, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'sent') returning *`,
      [id, po.locationId, po.approvalId, po.itemId, po.itemName, po.qty, po.unit, po.unitCost, po.totalCost, po.supplier, createdAt],
    );
    return mapRow(rows[0]);
  }

  async list(locationId: string): Promise<PurchaseOrder[]> {
    const { rows } = await this.pool.query<PORow>(`select * from purchase_orders where location_id = $1 order by created_at desc`, [locationId]);
    return rows.map(mapRow);
  }
}
