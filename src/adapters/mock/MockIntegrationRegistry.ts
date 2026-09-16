import type { IntegrationRegistry } from "@/ports/IntegrationRegistry";
import type { Integration } from "@/core/types";
import { fixtures, latency } from "./data";

export class MockIntegrationRegistry implements IntegrationRegistry {
  async listIntegrations(locationId: string): Promise<Integration[]> {
    return latency(fixtures.integrations.find((i) => i.locationId === locationId)?.integrations ?? [], 40);
  }
}
