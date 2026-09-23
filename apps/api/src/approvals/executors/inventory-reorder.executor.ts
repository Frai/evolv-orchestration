import { Injectable, Logger } from "@nestjs/common";
import type { Approval } from "@evolv/contracts/types";
import { reorderCost, reorderQty } from "@evolv/contracts/inventory";
import { StockStoreService } from "../../inventory/stock-store.service";
import { PurchaseOrderLedgerService } from "../../purchase-orders/purchase-order-ledger.service";
import type { ApprovalExecutor } from "./approval-executor";

/**
 * The one real downstream write in this demo: approving an Inventory Guard reorder
 * creates a purchase order and bumps the item's stock back above par.
 */
@Injectable()
export class InventoryReorderExecutor implements ApprovalExecutor {
  private readonly logger = new Logger(InventoryReorderExecutor.name);

  constructor(
    private readonly stock: StockStoreService,
    private readonly ledger: PurchaseOrderLedgerService,
  ) {}

  async execute(approval: Approval): Promise<string> {
    if (!approval.itemId) {
      this.logger.warn(`Approval ${approval.id} has no itemId; falling back to the canned confirmation.`);
      return approval.confirmation;
    }
    const item = this.stock.find(approval.locationId, approval.itemId);
    if (!item) {
      this.logger.warn(`Stock item ${approval.itemId} not found for ${approval.locationId}; falling back to the canned confirmation.`);
      return approval.confirmation;
    }

    const qty = reorderQty(item);
    const totalCost = reorderCost(item);
    const po = this.ledger.create({
      locationId: item.locationId,
      approvalId: approval.id,
      itemId: item.itemId,
      itemName: item.name,
      qty,
      unit: item.unit,
      unitCost: item.unitCost,
      totalCost,
      supplier: item.supplier,
    });
    this.stock.setOnHand(item.locationId, item.itemId, item.par + item.dailyUsage);

    return `Purchase order #${po.id} sent to ${item.supplier}: ${qty} ${item.unit} ${item.name.toLowerCase()}. Delivery expected tomorrow before 10 AM.`;
  }
}
