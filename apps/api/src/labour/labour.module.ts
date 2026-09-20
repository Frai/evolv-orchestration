import { Module } from "@nestjs/common";
import { FixturesModule } from "../fixtures/fixtures.module";
import { LabourController } from "./labour.controller";
import { LABOUR_SOURCE } from "./labour-source.token";
import { MockLabourSource } from "./providers/mock-labour.provider";

@Module({
  imports: [FixturesModule],
  controllers: [LabourController],
  providers: [{ provide: LABOUR_SOURCE, useClass: MockLabourSource }],
  exports: [LABOUR_SOURCE],
})
export class LabourModule {}
