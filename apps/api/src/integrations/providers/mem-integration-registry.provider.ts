import { Injectable } from "@nestjs/common";
import type { IntegrationRegistry } from "@evolv/contracts/ports";
import type { Integration } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemIntegrationRegistry implements IntegrationRegistry {
  constructor(private readonly store: StoreService) {}

  async listIntegrations(companyId: string): Promise<Integration[]> {
    return this.store.fx.integrations.find((i) => i.companyId === companyId)?.integrations ?? [];
  }
}
