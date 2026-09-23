import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { InventoryModule } from "../inventory/inventory.module";
import { PurchaseOrdersModule } from "../purchase-orders/purchase-orders.module";
import { ApprovalsController } from "./approvals.controller";
import { APPROVAL_QUEUE } from "./approval-queue.token";
import { MockApprovalQueue } from "./providers/mock-approval-queue.provider";
import { ApprovalStoreService } from "./approval-store.service";
import { ApprovalsService } from "./approvals.service";
import { InventoryReorderExecutor } from "./executors/inventory-reorder.executor";
import { MenuChangeExecutor } from "./executors/menu-change.executor";
import { ScheduleChangeExecutor } from "./executors/schedule-change.executor";
import { KitchenPacingExecutor } from "./executors/kitchen-pacing.executor";
import { DefaultExecutor } from "./executors/default.executor";

@Module({
  imports: [FixturesModule, InventoryModule, PurchaseOrdersModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalStoreService,
    InventoryReorderExecutor,
    MenuChangeExecutor,
    ScheduleChangeExecutor,
    KitchenPacingExecutor,
    DefaultExecutor,
    ApprovalsService,
    { provide: APPROVAL_QUEUE, useClass: MockApprovalQueue },
  ],
  exports: [APPROVAL_QUEUE, ApprovalStoreService],
})
export class ApprovalsModule {}
