import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { PROJECT_SOURCE } from "./projects-source.token";
import { PgProjectSource } from "./providers/pg-project.provider";

@Module({
  controllers: [ProjectsController],
  providers: [{ provide: PROJECT_SOURCE, useClass: PgProjectSource }],
  exports: [PROJECT_SOURCE],
})
export class ProjectsModule {}
