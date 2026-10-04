import { buildFixtureSet, type DeliveryFixture, type FixtureSet } from "./gen/build";

/**
 * The demo's whole world, held in the browser's memory. Built once, on first use, from the seeded
 * fixture generator, so everyone sees the same story for a given date (pin it with
 * NEXT_PUBLIC_FIXTURE_TODAY). `approvals`, `changeOrders` and `deliveries` are the mutable parts:
 * resolving an approval changes them until the page is reloaded. Nothing is persisted and nothing
 * leaves the browser.
 */
export interface DemoStore {
  fx: FixtureSet;
  deliveries: DeliveryFixture[];
}

let store: DemoStore | undefined;

export function getStore(): DemoStore {
  if (!store) {
    const fx = buildFixtureSet();
    store = { fx, deliveries: [...fx.deliveries] };
  }
  return store;
}

/** Throws the world away so the next call rebuilds it. For tests. */
export function resetStore(): void {
  store = undefined;
}
