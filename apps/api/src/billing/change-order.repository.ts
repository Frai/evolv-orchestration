import { Injectable } from "@nestjs/common";
import type { ChangeOrder } from "@evolv/contracts/types";
import { StoreService } from "../store/store.service";

export interface ExtraWorkCode {
  codeId: string;
  jobId: string;
  name: string;
  client: string;
}

export interface NewChangeOrder {
  jobId: string;
  codeId: string;
  title: string;
  amount: number;
}

/** The one real downstream write in this demo: approving a change-order draft adds a change order here. */
@Injectable()
export class ChangeOrderRepository {
  constructor(private readonly store: StoreService) {}

  async findExtraWorkCode(codeId: string): Promise<ExtraWorkCode | undefined> {
    const code = this.store.fx.codes.find((c) => c.id === codeId);
    const job = code && this.store.fx.jobs.find((j) => j.id === code.jobId);
    return code && job ? { codeId: code.id, jobId: code.jobId, name: code.name, client: job.client } : undefined;
  }

  /** Creates the change order as pending (submitted to the client, not yet approved by them). */
  async create(input: NewChangeOrder): Promise<ChangeOrder> {
    const seq = this.store.fx.changeOrders.filter((c) => c.jobId === input.jobId).length + 1;
    const now = new Date().toISOString();
    const co: ChangeOrder = {
      id: `${input.jobId}:co-${seq}`,
      jobId: input.jobId,
      number: `CO-${String(seq).padStart(3, "0")}`,
      title: input.title,
      amount: input.amount,
      status: "pending",
      codeId: input.codeId,
      createdAt: now,
      submittedAt: now,
    };
    this.store.fx.changeOrders.push(co);
    return co;
  }
}
