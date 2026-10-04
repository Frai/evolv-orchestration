import { Injectable } from "@nestjs/common";
import { buildFixtureSet, type DeliveryFixture, type FixtureSet } from "../fixtures/gen/build";

/**
 * The demo's whole world, held in process memory. Built once at startup from the seeded fixture
 * generator, so every instance tells the same story for a given date (pin it with FIXTURE_TODAY).
 * `approvals` and `changeOrders` are the mutable parts: resolving an approval changes them for
 * real until the process restarts. Nothing is persisted.
 */
@Injectable()
export class StoreService {
  readonly fx: FixtureSet = buildFixtureSet();
  readonly deliveries: DeliveryFixture[] = [...this.fx.deliveries];
}
