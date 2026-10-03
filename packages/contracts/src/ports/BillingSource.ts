import type { ChangeOrder, FieldTicket, Invoice } from "../domain";

/** Field tickets, progress invoices and change orders: the path from work performed to cash. */
export interface BillingSource {
  getFieldTickets(companyId: string, jobId?: string): Promise<FieldTicket[]>;
  getInvoices(companyId: string, jobId?: string): Promise<Invoice[]>;
  getChangeOrders(companyId: string, jobId?: string): Promise<ChangeOrder[]>;
}
