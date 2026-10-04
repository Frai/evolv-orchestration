import { Injectable } from "@nestjs/common";
import type { Notifier } from "@evolv/contracts/ports";
import type { DeliveryChannel, DeliveryReceipt } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemNotifier implements Notifier {
  constructor(private readonly store: StoreService) {}

  async send(channel: DeliveryChannel, to: string[], _subject: string, _body: string): Promise<DeliveryReceipt> {
    const sentAt = new Date().toISOString();
    // The Notifier.send() port has no companyId, so a live send is logged without one.
    this.store.deliveries.push({ companyId: "", channel, sentAt, to });
    return { channel, to, sentAt };
  }

  async lastDelivery(companyId: string): Promise<DeliveryReceipt | undefined> {
    const latest = this.store.deliveries.filter((d) => d.companyId === companyId).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    return latest ? { channel: latest.channel, sentAt: latest.sentAt, to: latest.to } : undefined;
  }
}
