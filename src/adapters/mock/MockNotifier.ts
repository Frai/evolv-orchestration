import type { Notifier } from "@/ports/Notifier";
import type { DeliveryChannel, DeliveryReceipt } from "@/core/types";
import { fixtures, latency } from "./data";

export class MockNotifier implements Notifier {
  async send(channel: DeliveryChannel, to: string[]): Promise<DeliveryReceipt> {
    return latency({ channel, to, sentAt: new Date().toISOString() }, 400);
  }
  async lastDelivery(locationId: string): Promise<DeliveryReceipt | undefined> {
    const d = fixtures.deliveries.find((x) => x.locationId === locationId);
    return latency(d ? { channel: d.channel, sentAt: d.sentAt, to: d.to } : undefined, 20);
  }
}
