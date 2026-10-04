import type { Approval } from "@evolv/contracts/types";

/** Runs when an approval is approved, before the approval's own status is recorded. */
export interface ApprovalExecutor {
  execute(approval: Approval): Promise<string>;
}
