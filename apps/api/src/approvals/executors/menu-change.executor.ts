import { Injectable } from "@nestjs/common";
import type { Approval } from "@evolv/contracts/types";
import type { ApprovalExecutor } from "./approval-executor";

/** No real POS menu write yet — persists the decision, keeps the existing canned confirmation. */
@Injectable()
export class MenuChangeExecutor implements ApprovalExecutor {
  async execute(approval: Approval): Promise<string> {
    return approval.confirmation;
  }
}
