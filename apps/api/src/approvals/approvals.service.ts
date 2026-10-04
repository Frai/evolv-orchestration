import { Injectable, NotFoundException } from "@nestjs/common";
import type { Approval } from "@evolv/contracts/types";
import type { ResolveApprovalInput } from "@evolv/contracts/ports";
import { ApprovalRepository } from "./approval.repository";
import type { ApprovalExecutor } from "./executors/approval-executor";
import { ChangeOrderExecutor } from "./executors/change-order.executor";
import { DefaultExecutor } from "./executors/default.executor";

/** Resolves approvals and dispatches to the right execution handler by agentId. */
@Injectable()
export class ApprovalsService {
  private readonly executors: Record<string, ApprovalExecutor>;

  constructor(
    private readonly store: ApprovalRepository,
    changeOrder: ChangeOrderExecutor,
    private readonly defaultExecutor: DefaultExecutor,
  ) {
    // Only the Change-Order Catcher writes anything. Every other agent drafts and a person sends.
    this.executors = { "change-order-catcher": changeOrder };
  }

  list(companyId: string): Promise<Approval[]> {
    return this.store.list(companyId);
  }

  async resolve(input: ResolveApprovalInput): Promise<Approval> {
    const approval = await this.store.get(input.approvalId);
    if (!approval) throw new NotFoundException(`Approval ${input.approvalId} not found`);
    if (approval.status !== "pending") return approval; // already decided; resolving twice must not write twice

    const action = input.editedAction ?? approval.action;
    let confirmation = approval.confirmation;
    if (input.status === "approved") {
      const executor = this.executors[approval.agentId] ?? this.defaultExecutor;
      confirmation = await executor.execute({ ...approval, action });
    }
    return this.store.update(approval.id, { status: input.status, resolvedAt: new Date().toISOString(), action, confirmation });
  }
}
