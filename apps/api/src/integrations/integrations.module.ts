import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { IntegrationsController } from "./integrations.controller";
import { INTEGRATION_REGISTRY } from "./integration-registry.token";
import { MockIntegrationRegistry } from "./providers/mock-integration-registry.provider";

@Module({
  imports: [FixturesModule],
  controllers: [IntegrationsController],
  providers: [{ provide: INTEGRATION_REGISTRY, useClass: MockIntegrationRegistry }],
  exports: [INTEGRATION_REGISTRY],
})
export class IntegrationsModule {}
