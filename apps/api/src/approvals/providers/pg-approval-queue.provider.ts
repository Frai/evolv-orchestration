import { Injectable } from "@nestjs/common";
import type { ApprovalQueue, ResolveApprovalInput } from "@evolv/contracts/ports";
import type { Approval } from "@evolv/contracts/types";
import { ApprovalsService } from "../approvals.service";

@Injectable()
export class PgApprovalQueue implements ApprovalQueue {
  constructor(private readonly approvals: ApprovalsService) {}

  async listApprovals(locationId: string): Promise<Approval[]> {
    return this.approvals.list(locationId);
  }

  async resolve(input: ResolveApprovalInput): Promise<Approval> {
    return this.approvals.resolve(input);
  }
}
