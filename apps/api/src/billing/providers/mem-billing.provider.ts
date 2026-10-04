import { Injectable } from "@nestjs/common";
import type { BillingSource } from "@evolv/contracts/ports";
import type { ChangeOrder, FieldTicket, Invoice } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemBillingSource implements BillingSource {
  constructor(private readonly store: StoreService) {}

  private jobIds(companyId: string): Set<string> {
    return new Set(this.store.fx.jobs.filter((j) => j.companyId === companyId).map((j) => j.id));
  }

  async getFieldTickets(companyId: string, jobId?: string): Promise<FieldTicket[]> {
    return this.store.fx.tickets
      .filter((t) => t.companyId === companyId && (!jobId || t.jobId === jobId))
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }

  async getInvoices(companyId: string, jobId?: string): Promise<Invoice[]> {
    const ids = this.jobIds(companyId);
    return this.store.fx.invoices.filter((i) => ids.has(i.jobId) && (!jobId || i.jobId === jobId)).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  }

  async getChangeOrders(companyId: string, jobId?: string): Promise<ChangeOrder[]> {
    const ids = this.jobIds(companyId);
    return this.store.fx.changeOrders.filter((c) => ids.has(c.jobId) && (!jobId || c.jobId === jobId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
