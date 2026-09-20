import { Injectable } from "@nestjs/common";
import type { Notifier } from "@evolv/contracts/ports";
import type { DeliveryChannel, DeliveryReceipt } from "@evolv/contracts/types";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

@Injectable()
export class MockNotifier implements Notifier {
  constructor(private readonly fixtures: FixturesService) {}

  async send(channel: DeliveryChannel, to: string[]): Promise<DeliveryReceipt> {
    return latency({ channel, to, sentAt: new Date().toISOString() }, 400);
  }
  async lastDelivery(locationId: string): Promise<DeliveryReceipt | undefined> {
    const d = this.fixtures.deliveries.find((x) => x.locationId === locationId);
    return latency(d ? { channel: d.channel, sentAt: d.sentAt, to: d.to } : undefined, 20);
  }
}
