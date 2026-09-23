import { Injectable, Logger } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";
import { reorderCost, reorderQty } from "@evolv/contracts/inventory";
import { StockRepository } from "../../inventory/stock.repository";
import { PurchaseOrderRepository } from "../../purchase-orders/purchase-order.repository";
import type { ApprovalExecutor } from "./approval-executor";

/**
 * The one real downstream write in this demo: approving an Inventory Guard reorder
 * creates a purchase order and bumps the item's stock back above par. Runs inside the
 * same transaction as the approval's own status update (see ApprovalsService.resolve),
 * so all three writes commit or fail together.
 */
@Injectable()
export class InventoryReorderExecutor implements ApprovalExecutor {
  private readonly logger = new Logger(InventoryReorderExecutor.name);

  constructor(
    private readonly stock: StockRepository,
    private readonly ledger: PurchaseOrderRepository,
  ) {}

  async execute(approval: Approval, client: PoolClient): Promise<string> {
    if (!approval.itemId) {
      this.logger.warn(`Approval ${approval.id} has no itemId; falling back to the canned confirmation.`);
      return approval.confirmation;
    }
    const item = await this.stock.find(approval.locationId, approval.itemId, client);
    if (!item) {
      this.logger.warn(`Stock item ${approval.itemId} not found for ${approval.locationId}; falling back to the canned confirmation.`);
      return approval.confirmation;
    }

    const qty = reorderQty(item);
    const totalCost = reorderCost(item);
    const po = await this.ledger.create(
      {
        locationId: item.locationId,
        approvalId: approval.id,
        itemId: item.itemId,
        itemName: item.name,
        qty,
        unit: item.unit,
        unitCost: item.unitCost,
        totalCost,
        supplier: item.supplier,
      },
      client,
    );
    await this.stock.setOnHand(item.locationId, item.itemId, item.par + item.dailyUsage, client);

    return `Purchase order #${po.id} sent to ${item.supplier}: ${qty} ${item.unit} ${item.name.toLowerCase()}. Delivery expected tomorrow before 10 AM.`;
  }
}
