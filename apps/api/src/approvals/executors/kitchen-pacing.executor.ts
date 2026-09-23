import { Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import type { Approval } from "@evolv/contracts/types";
import type { ApprovalExecutor } from "./approval-executor";

/** No real delivery-platform intake toggle yet — persists the decision, keeps the existing canned confirmation. */
@Injectable()
export class KitchenPacingExecutor implements ApprovalExecutor {
  async execute(approval: Approval, _client: PoolClient): Promise<string> {
    return approval.confirmation;
  }
}
