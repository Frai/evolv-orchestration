import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { IntegrationRegistry } from "@evolv/contracts/ports";
import { INTEGRATION_REGISTRY } from "./integration-registry.token";

@Controller("integrations")
export class IntegrationsController {
  constructor(@Inject(INTEGRATION_REGISTRY) private readonly registry: IntegrationRegistry) {}

  @Get()
  listIntegrations(@Query("locationId") locationId: string) {
    return this.registry.listIntegrations(locationId);
  }
}
