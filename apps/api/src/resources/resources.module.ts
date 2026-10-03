import { Module } from "@nestjs/common";
import { ResourcesController } from "./resources.controller";
import { RESOURCE_SOURCE } from "./resource-source.token";
import { PgResourceSource } from "./providers/pg-resource.provider";

@Module({
  controllers: [ResourcesController],
  providers: [{ provide: RESOURCE_SOURCE, useClass: PgResourceSource }],
  exports: [RESOURCE_SOURCE],
})
export class ResourcesModule {}
