import { Injectable } from "@nestjs/common";
import type { IntegrationRegistry } from "@evolv/contracts/ports";
import type { Integration } from "@evolv/contracts/types";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

@Injectable()
export class MockIntegrationRegistry implements IntegrationRegistry {
  constructor(private readonly fixtures: FixturesService) {}

  async listIntegrations(locationId: string): Promise<Integration[]> {
    return latency(this.fixtures.integrations.find((i) => i.locationId === locationId)?.integrations ?? [], 40);
  }
}
