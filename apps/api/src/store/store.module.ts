import { Global, Module } from "@nestjs/common";
import { StoreService } from "./store.service";

/** Global so every feature module can inject StoreService without re-importing this module. */
@Global()
@Module({ providers: [StoreService], exports: [StoreService] })
export class StoreModule {}
