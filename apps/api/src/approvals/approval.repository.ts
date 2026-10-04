import { Injectable } from "@nestjs/common";
import type { Approval } from "@evolv/contracts/types";
import { StoreService } from "../store/store.service";

@Injectable()
export class ApprovalRepository {
  constructor(private readonly store: StoreService) {}

  async list(companyId: string): Promise<Approval[]> {
    return this.store.fx.approvals.filter((a) => a.companyId === companyId).sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));
  }

  async get(id: string): Promise<Approval | undefined> {
    return this.store.fx.approvals.find((a) => a.id === id);
  }

  async update(id: string, patch: Partial<Pick<Approval, "status" | "resolvedAt" | "action" | "confirmation">>): Promise<Approval> {
    const approval = this.store.fx.approvals.find((a) => a.id === id);
    if (!approval) throw new Error(`Approval ${id} not found`);
    if (patch.status !== undefined) approval.status = patch.status;
    if (patch.resolvedAt !== undefined) approval.resolvedAt = patch.resolvedAt;
    if (patch.action !== undefined) approval.action = patch.action;
    if (patch.confirmation !== undefined) approval.confirmation = patch.confirmation;
    return approval;
  }
}
