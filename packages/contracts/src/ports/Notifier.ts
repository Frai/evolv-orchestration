import type { DeliveryChannel, DeliveryReceipt } from "../domain";

export interface Notifier {
  send(channel: DeliveryChannel, to: string[], subject: string, body: string): Promise<DeliveryReceipt>;
  /** Most recent delivery of the morning brief for a location. */
  lastDelivery(locationId: string): Promise<DeliveryReceipt | undefined>;
}
