import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { ApprovalQueue } from "@evolv/contracts/ports";
import { APPROVAL_QUEUE } from "./approval-queue.token";

@Controller("approvals")
export class ApprovalsController {
  constructor(@Inject(APPROVAL_QUEUE) private readonly queue: ApprovalQueue) {}

  @Get()
  listApprovals(@Query("locationId") locationId: string) {
    return this.queue.listApprovals(locationId);
  }
}
