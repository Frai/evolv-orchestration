import type { PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";

/** Runs when an approval is approved, inside the same transaction as the approval's own status update. */
export interface ApprovalExecutor {
  execute(approval: Approval, client: PoolClient): Promise<string>;
}
