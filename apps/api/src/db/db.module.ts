import { Global, Module } from "@nestjs/common";
import { PG_POOL, createPgPool } from "./pg-pool.provider";

/** Global so every feature module can @Inject(PG_POOL) without re-importing this module. */
@Global()
@Module({
  providers: [{ provide: PG_POOL, useFactory: createPgPool }],
  exports: [PG_POOL],
})
export class DbModule {}
