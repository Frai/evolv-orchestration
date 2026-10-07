import type { Integration } from "../domain";

export interface IntegrationRegistry {
  listIntegrations(companyId: string): Promise<Integration[]>;
}
