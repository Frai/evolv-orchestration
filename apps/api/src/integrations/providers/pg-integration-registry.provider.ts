import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { IntegrationRegistry } from "@evolv/contracts/ports";
import type { Integration } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";

@Injectable()
export class PgIntegrationRegistry implements IntegrationRegistry {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listIntegrations(locationId: string): Promise<Integration[]> {
    const { rows } = await this.pool.query<{
      integration_id: string; name: string; area: string; description: string; state: string; last_sync_at: string | null;
    }>(`select integration_id, name, area, description, state, last_sync_at from integrations where location_id = $1`, [locationId]);
    return rows.map((r) => ({
      id: r.integration_id,
      name: r.name,
      area: r.area as Integration["area"],
      description: r.description,
      state: r.state as Integration["state"],
      lastSyncAt: r.last_sync_at ?? undefined,
    }));
  }
}
