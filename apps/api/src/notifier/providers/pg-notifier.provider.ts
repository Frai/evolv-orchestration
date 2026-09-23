import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { Notifier } from "@evolv/contracts/ports";
import type { DeliveryChannel, DeliveryReceipt } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";

@Injectable()
export class PgNotifier implements Notifier {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async send(channel: DeliveryChannel, to: string[], _subject: string, _body: string): Promise<DeliveryReceipt> {
    const sentAt = new Date().toISOString();
    // The single Notifier.send() signature covers every location this delivery goes to;
    // there is no locationId on the port, so this appends a channel-only audit row.
    await this.pool.query(`insert into deliveries (location_id, channel, sent_at, recipients) values ($1,$2,$3,$4)`, [null, channel, sentAt, to]);
    return { channel, to, sentAt };
  }

  async lastDelivery(locationId: string): Promise<DeliveryReceipt | undefined> {
    const { rows } = await this.pool.query<{ channel: DeliveryChannel; sent_at: string; recipients: string[] }>(
      `select channel, sent_at, recipients from deliveries where location_id = $1 order by sent_at desc limit 1`,
      [locationId],
    );
    const r = rows[0];
    return r ? { channel: r.channel, sentAt: r.sent_at, to: r.recipients } : undefined;
  }
}
