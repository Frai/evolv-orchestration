import { Injectable } from "@nestjs/common";
import type { ApprovalQueue, ResolveApprovalInput } from "@evolv/contracts/ports";
import type { Approval } from "@evolv/contracts/types";
import { latency } from "../../fixtures/fixtures.service";
import { ApprovalsService } from "../approvals.service";

@Injectable()
export class MockApprovalQueue implements ApprovalQueue {
  constructor(private readonly approvals: ApprovalsService) {}

  async listApprovals(locationId: string): Promise<Approval[]> {
    return latency(this.approvals.list(locationId));
  }

  async resolve(input: ResolveApprovalInput): Promise<Approval> {
    return latency(await this.approvals.resolve(input), 250);
  }
}
