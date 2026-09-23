import { Injectable } from "@nestjs/common";
import type { PurchaseOrder } from "./purchase-order.types";

/**
 * The one real downstream write in this demo: approving an Inventory Guard reorder
 * creates a row here. In-memory, process-lifetime — no real distributor API exists yet
 * to swap in; add one when it does.
 */
@Injectable()
export class PurchaseOrderLedgerService {
  private readonly orders: PurchaseOrder[] = [];
  private seq = 1;

  create(po: Omit<PurchaseOrder, "id" | "createdAt" | "status">): PurchaseOrder {
    const order: PurchaseOrder = {
      ...po,
      id: `po-${String(this.seq++).padStart(4, "0")}`,
      createdAt: new Date().toISOString(),
      status: "sent",
    };
    this.orders.push(order);
    return order;
  }

  list(locationId: string): PurchaseOrder[] {
    return this.orders.filter((o) => o.locationId === locationId);
  }
}
