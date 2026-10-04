import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { PROJECT_SOURCE } from "./projects-source.token";
import { MemProjectSource } from "./providers/mem-project.provider";

@Module({
  controllers: [ProjectsController],
  providers: [{ provide: PROJECT_SOURCE, useClass: MemProjectSource }],
  exports: [PROJECT_SOURCE],
})
export class ProjectsModule {}
