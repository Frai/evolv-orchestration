import type { SafetyEvent } from "../domain";

/** Incidents, near-misses and inspection findings. Evolv routes and reminds; humans decide. */
export interface SafetySource {
  getSafetyEvents(companyId: string, jobId?: string): Promise<SafetyEvent[]>;
}
