import type { Approval } from "@/core/types";

export interface ApprovalQueue {
  /** Initial queue as proposed by agents. Resolution state lives in the app session. */
  listApprovals(locationId: string): Promise<Approval[]>;
}
