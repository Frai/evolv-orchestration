import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { PurchaseOrdersModule } from "../purchase-orders/purchase-orders.module";
import { ApprovalsController } from "./approvals.controller";
import { APPROVAL_QUEUE } from "./approval-queue.token";
import { PgApprovalQueue } from "./providers/pg-approval-queue.provider";
import { ApprovalRepository } from "./approval.repository";
import { ApprovalsService } from "./approvals.service";
import { InventoryReorderExecutor } from "./executors/inventory-reorder.executor";
import { MenuChangeExecutor } from "./executors/menu-change.executor";
import { ScheduleChangeExecutor } from "./executors/schedule-change.executor";
import { KitchenPacingExecutor } from "./executors/kitchen-pacing.executor";
import { DefaultExecutor } from "./executors/default.executor";

@Module({
  imports: [InventoryModule, PurchaseOrdersModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalRepository,
    InventoryReorderExecutor,
    MenuChangeExecutor,
    ScheduleChangeExecutor,
    KitchenPacingExecutor,
    DefaultExecutor,
    ApprovalsService,
    { provide: APPROVAL_QUEUE, useClass: PgApprovalQueue },
  ],
  exports: [APPROVAL_QUEUE, ApprovalRepository],
})
export class ApprovalsModule {}
