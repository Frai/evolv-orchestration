import { Injectable } from "@nestjs/common";
import type { ResourceSource } from "@evolv/contracts/ports";
import type { Commitment, Equipment } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemResourceSource implements ResourceSource {
  constructor(private readonly store: StoreService) {}

  private jobIds(companyId: string): Set<string> {
    return new Set(this.store.fx.jobs.filter((j) => j.companyId === companyId).map((j) => j.id));
  }

  async getEquipment(companyId: string, jobId?: string): Promise<Equipment[]> {
    const ids = this.jobIds(companyId);
    return this.store.fx.equipment.filter((e) => ids.has(e.jobId) && (!jobId || e.jobId === jobId)).sort((a, b) => a.jobId.localeCompare(b.jobId) || a.name.localeCompare(b.name));
  }

  async getCommitments(companyId: string, jobId?: string): Promise<Commitment[]> {
    const ids = this.jobIds(companyId);
    return this.store.fx.commitments.filter((c) => ids.has(c.jobId) && (!jobId || c.jobId === jobId)).sort((a, b) => a.needDate.localeCompare(b.needDate));
  }
}
