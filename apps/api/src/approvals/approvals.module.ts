import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { ApprovalsController } from "./approvals.controller";
import { APPROVAL_QUEUE } from "./approval-queue.token";
import { MockApprovalQueue } from "./providers/mock-approval-queue.provider";

@Module({
  imports: [FixturesModule],
  controllers: [ApprovalsController],
  providers: [{ provide: APPROVAL_QUEUE, useClass: MockApprovalQueue }],
  exports: [APPROVAL_QUEUE],
})
export class ApprovalsModule {}
