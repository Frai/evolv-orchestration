import { Module } from "@nestjs/common";
import { IntegrationsController } from "./integrations.controller";
import { INTEGRATION_REGISTRY } from "./integration-registry.token";
import { PgIntegrationRegistry } from "./providers/pg-integration-registry.provider";

@Module({
  controllers: [IntegrationsController],
  providers: [{ provide: INTEGRATION_REGISTRY, useClass: PgIntegrationRegistry }],
  exports: [INTEGRATION_REGISTRY],
})
export class IntegrationsModule {}
