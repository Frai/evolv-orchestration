import { Injectable } from "@nestjs/common";
import type { ApprovalQueue } from "@evolv/contracts/ports";
import type { Approval } from "@evolv/contracts/types";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

@Injectable()
export class MockApprovalQueue implements ApprovalQueue {
  constructor(private readonly fixtures: FixturesService) {}

  async listApprovals(locationId: string): Promise<Approval[]> {
    return latency(this.fixtures.approvals.filter((a) => a.locationId === locationId));
  }
}
