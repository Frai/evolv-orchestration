import { Module } from "@nestjs/common";
import { LabourController } from "./labour.controller";
import { LABOUR_SOURCE } from "./labour-source.token";
import { PgLabourSource } from "./providers/pg-labour.provider";

@Module({
  controllers: [LabourController],
  providers: [{ provide: LABOUR_SOURCE, useClass: PgLabourSource }],
  exports: [LABOUR_SOURCE],
})
export class LabourModule {}
