import type { Integration } from "@/core/types";

export interface IntegrationRegistry {
  listIntegrations(locationId: string): Promise<Integration[]>;
}
