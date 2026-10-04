import type { Commitment, Equipment } from "../domain";

/** Fleet telematics and procurement: what is on site, what is on order, and when it lands. */
export interface ResourceSource {
  getEquipment(companyId: string, jobId?: string): Promise<Equipment[]>;
  getCommitments(companyId: string, jobId?: string): Promise<Commitment[]>;
}
