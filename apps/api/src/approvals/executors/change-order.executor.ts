import { Injectable, Logger } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";
import { money } from "@evolv/contracts/format";
import { ChangeOrderRepository } from "../../billing/change-order.repository";
import type { ApprovalExecutor } from "./approval-executor";

/**
 * The one real downstream write in this demo: approving a Change-Order Catcher draft inserts a
 * pending change order for the extra-work cost code. Runs inside the same transaction as the
 * approval's own status update (see ApprovalsService.resolve), so both commit or fail together.
 * Once the change order exists, the "no change order on file" signal clears on the next load.
 */
@Injectable()
export class ChangeOrderExecutor implements ApprovalExecutor {
  private readonly logger = new Logger(ChangeOrderExecutor.name);

  constructor(private readonly changeOrders: ChangeOrderRepository) {}

  async execute(approval: Approval, client: PoolClient): Promise<string> {
    if (!approval.refId) {
      this.logger.warn(`Approval ${approval.id} has no refId; falling back to the canned confirmation.`);
      return approval.confirmation;
    }
    const code = await this.changeOrders.findExtraWorkCode(approval.refId, client);
    if (!code) {
      this.logger.warn(`Cost code ${approval.refId} not found; falling back to the canned confirmation.`);
      return approval.confirmation;
    }
    const amount = approval.amount ?? 0;
    const co = await this.changeOrders.create({ jobId: code.jobId, codeId: code.codeId, title: `Extra work: ${code.name}`, amount }, client);
    return `Change order ${co.number} for ${money(amount)} submitted to ${code.client} with backup attached. Awaiting their approval.`;
  }
}
