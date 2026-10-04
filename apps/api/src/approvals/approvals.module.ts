import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { ApprovalsController } from "./approvals.controller";
import { APPROVAL_QUEUE } from "./approval-queue.token";
import { MemApprovalQueue } from "./providers/mem-approval-queue.provider";
import { ApprovalRepository } from "./approval.repository";
import { ApprovalsService } from "./approvals.service";
import { ChangeOrderExecutor } from "./executors/change-order.executor";
import { DefaultExecutor } from "./executors/default.executor";

@Module({
  imports: [BillingModule],
  controllers: [ApprovalsController],
  providers: [
    ApprovalRepository,
    ChangeOrderExecutor,
    DefaultExecutor,
    ApprovalsService,
    { provide: APPROVAL_QUEUE, useClass: MemApprovalQueue },
  ],
  exports: [APPROVAL_QUEUE, ApprovalRepository],
})
export class ApprovalsModule {}
