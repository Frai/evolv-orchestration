import type { Approval } from "@evolv/contracts/types";

/** Runs when an approval is approved. Returns the confirmation text shown on the resolved card. */
export interface ApprovalExecutor {
  execute(approval: Approval): Promise<string>;
}
