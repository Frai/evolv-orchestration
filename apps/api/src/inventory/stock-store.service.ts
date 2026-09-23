import { Injectable } from "@nestjs/common";
import type { StockLevel } from "@evolv/contracts/types";
import { FixturesService } from "../fixtures/fixtures.service";

/** Process-lifetime mutable stock levels, seeded from fixtures, so a reorder can visibly bump onHand. */
@Injectable()
export class StockStoreService {
  private readonly byKey = new Map<string, StockLevel>();

  constructor(private readonly fixtures: FixturesService) {
    for (const s of fixtures.stock) this.byKey.set(key(s.locationId, s.itemId), { ...s });
  }

  list(locationId: string): StockLevel[] {
    return [...this.byKey.values()].filter((s) => s.locationId === locationId);
  }

  find(locationId: string, itemId: string): StockLevel | undefined {
    return this.byKey.get(key(locationId, itemId));
  }

  setOnHand(locationId: string, itemId: string, onHand: number): StockLevel {
    const current = this.byKey.get(key(locationId, itemId));
    if (!current) throw new Error(`Stock item ${itemId} not found for ${locationId}`);
    const next = { ...current, onHand, countedAt: new Date().toISOString() };
    this.byKey.set(key(locationId, itemId), next);
    return next;
  }
}

function key(locationId: string, itemId: string): string {
  return `${locationId}:${itemId}`;
}
