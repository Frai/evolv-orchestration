import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Pool } from "pg";
import type { Approval } from "@evolv/contracts/types";
import type { ResolveApprovalInput } from "@evolv/contracts/ports";
import { PG_POOL, withTransaction } from "../db/pg-pool.provider";
import { ApprovalRepository } from "./approval.repository";
import type { ApprovalExecutor } from "./executors/approval-executor";
import { InventoryReorderExecutor } from "./executors/inventory-reorder.executor";
import { MenuChangeExecutor } from "./executors/menu-change.executor";
import { ScheduleChangeExecutor } from "./executors/schedule-change.executor";
import { KitchenPacingExecutor } from "./executors/kitchen-pacing.executor";
import { DefaultExecutor } from "./executors/default.executor";

/** Resolves approvals and dispatches to the right execution handler by agentId. */
@Injectable()
export class ApprovalsService {
  private readonly executors: Record<string, ApprovalExecutor>;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly store: ApprovalRepository,
    inventoryReorder: InventoryReorderExecutor,
    menuChange: MenuChangeExecutor,
    scheduleChange: ScheduleChangeExecutor,
    kitchenPacing: KitchenPacingExecutor,
    private readonly defaultExecutor: DefaultExecutor,
  ) {
    this.executors = {
      "inventory-guard": inventoryReorder,
      "sales-watch": menuChange,
      "labour-optimizer": scheduleChange,
      "kitchen-pacing": kitchenPacing,
    };
  }

  list(locationId: string): Promise<Approval[]> {
    return this.store.list(locationId);
  }

  async resolve(input: ResolveApprovalInput): Promise<Approval> {
    return withTransaction(this.pool, async (client) => {
      const approval = await this.store.get(input.approvalId, client);
      if (!approval) throw new NotFoundException(`Approval ${input.approvalId} not found`);

      const action = input.editedAction ?? approval.action;
      let confirmation = approval.confirmation;
      if (input.status === "approved") {
        const executor = this.executors[approval.agentId] ?? this.defaultExecutor;
        confirmation = await executor.execute({ ...approval, action }, client);
      }

      return this.store.update(
        approval.id,
        { status: input.status, resolvedAt: new Date().toISOString(), action, confirmation },
        client,
      );
    });
  }
}
