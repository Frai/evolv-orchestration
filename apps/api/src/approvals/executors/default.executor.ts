import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";
import type { ApprovalExecutor } from "./approval-executor";

/**
 * Fallback for any agent without a dedicated executor: persists the decision, no downstream write.
 * Deliberate in the pilot: Evolv drafts and routes; a person sends the email, the billing package
 * or the reminder. Nothing writes back to a customer's accounting, payroll or safety system.
 */
@Injectable()
export class DefaultExecutor implements ApprovalExecutor {
  async execute(approval: Approval, _client: PoolClient): Promise<string> {
    return approval.confirmation;
  }
}
