import { Injectable } from "@nestjs/common";
import type { Approval } from "@evolv/contracts/types";
import type { ApprovalExecutor } from "./approval-executor";

/** Fallback for any agentId without a dedicated executor — persists the decision, no downstream write. */
@Injectable()
export class DefaultExecutor implements ApprovalExecutor {
  async execute(approval: Approval): Promise<string> {
    return approval.confirmation;
  }
}
