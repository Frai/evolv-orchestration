import type { Approval, ApprovalStatus } from "../domain";

export interface ResolveApprovalInput {
  approvalId: string;
  status: Extract<ApprovalStatus, "approved" | "rejected">;
  /** Present when resolved via the Edit flow; overwrites Approval.action before execution. */
  editedAction?: string;
}

export interface ApprovalQueue {
  listApprovals(locationId: string): Promise<Approval[]>;
  /** Persists the decision and, if approved, triggers downstream execution before returning. */
  resolve(input: ResolveApprovalInput): Promise<Approval>;
}
