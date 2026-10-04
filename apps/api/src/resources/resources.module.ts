import { Module } from "@nestjs/common";
import { ResourcesController } from "./resources.controller";
import { RESOURCE_SOURCE } from "./resource-source.token";
import { MemResourceSource } from "./providers/mem-resource.provider";

@Module({
  controllers: [ResourcesController],
  providers: [{ provide: RESOURCE_SOURCE, useClass: MemResourceSource }],
  exports: [RESOURCE_SOURCE],
})
export class ResourcesModule {}
