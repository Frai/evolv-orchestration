import type { Integration } from "../domain";

export interface IntegrationRegistry {
  listIntegrations(locationId: string): Promise<Integration[]>;
}
