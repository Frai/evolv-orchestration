import { Injectable } from "@nestjs/common";
import type { Approval } from "@evolv/contracts/types";
import { FixturesService } from "../fixtures/fixtures.service";

/**
 * Process-lifetime mutable store for approvals. Fixture JSON is read-only per process,
 * so resolving/proposing an approval needs somewhere real (if not durable) to write to.
 * Seeded from FixturesService at construction; resets on restart, same as session state.
 */
@Injectable()
export class ApprovalStoreService {
  private readonly byId = new Map<string, Approval>();

  constructor(private readonly fixtures: FixturesService) {
    for (const a of fixtures.approvals) this.byId.set(a.id, { ...a });
  }

  list(locationId: string): Approval[] {
    return [...this.byId.values()].filter((a) => a.locationId === locationId);
  }

  get(id: string): Approval | undefined {
    return this.byId.get(id);
  }

  update(id: string, patch: Partial<Approval>): Approval {
    const current = this.byId.get(id);
    if (!current) throw new Error(`Approval ${id} not found`);
    const next = { ...current, ...patch };
    this.byId.set(id, next);
    return next;
  }

  add(approval: Approval): void {
    this.byId.set(approval.id, approval);
  }
}
