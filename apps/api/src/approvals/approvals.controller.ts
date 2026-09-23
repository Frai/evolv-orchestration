import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import type { ApprovalQueue } from "@evolv/contracts/ports";
import { APPROVAL_QUEUE } from "./approval-queue.token";

interface ResolveApprovalBody {
  status: "approved" | "rejected";
  editedAction?: string;
}

@Controller("approvals")
export class ApprovalsController {
  constructor(@Inject(APPROVAL_QUEUE) private readonly queue: ApprovalQueue) {}

  @Get()
  listApprovals(@Query("locationId") locationId: string) {
    return this.queue.listApprovals(locationId);
  }

  @Post(":id/resolve")
  resolve(@Param("id") id: string, @Body() body: ResolveApprovalBody) {
    return this.queue.resolve({ approvalId: id, status: body.status, editedAction: body.editedAction });
  }
}
