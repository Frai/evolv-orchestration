import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { INTEGRATION_REGISTRY } from "./integration-registry.token";
import { MemIntegrationRegistry } from "./providers/mem-integration-registry.provider";

@Module({
  controllers: [IntegrationsController],
  providers: [{ provide: INTEGRATION_REGISTRY, useClass: MemIntegrationRegistry }],
  exports: [INTEGRATION_REGISTRY],
})
export class IntegrationsModule {}
