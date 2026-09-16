import type { ApprovalQueue } from "@/ports/ApprovalQueue";
import type { Approval } from "@/core/types";
import { fixtures, latency } from "./data";

export class MockApprovalQueue implements ApprovalQueue {
  async listApprovals(locationId: string): Promise<Approval[]> {
    return latency(fixtures.approvals.filter((a) => a.locationId === locationId));
  }
}
