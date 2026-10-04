import { Injectable } from "@nestjs/common";
import type { SafetySource } from "@evolv/contracts/ports";
import type { SafetyEvent } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemSafetySource implements SafetySource {
  constructor(private readonly store: StoreService) {}

  async getSafetyEvents(companyId: string, jobId?: string): Promise<SafetyEvent[]> {
    const ids = new Set(this.store.fx.jobs.filter((j) => j.companyId === companyId).map((j) => j.id));
    return this.store.fx.safety.filter((s) => ids.has(s.jobId) && (!jobId || s.jobId === jobId)).sort((a, b) => b.date.localeCompare(a.date));
  }
}
