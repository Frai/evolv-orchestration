import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { BillingSource } from "@evolv/contracts/ports";
import type { ChangeOrder, FieldTicket, Invoice } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";
import { mapChangeOrder, type ChangeOrderRow } from "../change-order.repository";

interface TicketRow {
  id: string;
  company_id: string;
  job_id: string;
  number: string;
  date: string;
  crew: string;
  description: string;
  labour_hours: number;
  equipment_hours: number;
  amount: number;
  status: FieldTicket["status"];
  signed_at: string | null;
  submitted_at: string | null;
  dispute_reason: string | null;
}

interface InvoiceRow {
  id: string;
  job_id: string;
  number: string;
  period_end: string;
  amount: number;
  status: Invoice["status"];
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
}

@Injectable()
export class PgBillingSource implements BillingSource {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getFieldTickets(companyId: string, jobId?: string): Promise<FieldTicket[]> {
    const { rows } = await this.pool.query<TicketRow>(
      `select * from field_tickets where company_id = $1 and ($2::text is null or job_id = $2) order by date desc, number desc`,
      [companyId, jobId ?? null],
    );
    return rows.map((r) => ({
      id: r.id,
      companyId: r.company_id,
      jobId: r.job_id,
      number: r.number,
      date: r.date,
      crew: r.crew,
      description: r.description,
      labourHours: r.labour_hours,
      equipmentHours: r.equipment_hours,
      amount: r.amount,
      status: r.status,
      signedAt: r.signed_at ?? undefined,
      submittedAt: r.submitted_at ?? undefined,
      disputeReason: r.dispute_reason ?? undefined,
    }));
  }

  async getInvoices(companyId: string, jobId?: string): Promise<Invoice[]> {
    const { rows } = await this.pool.query<InvoiceRow>(
      `select i.* from invoices i join jobs j on j.id = i.job_id
       where j.company_id = $1 and ($2::text is null or i.job_id = $2) order by i.period_end desc`,
      [companyId, jobId ?? null],
    );
    return rows.map((r) => ({
      id: r.id,
      jobId: r.job_id,
      number: r.number,
      periodEnd: r.period_end,
      amount: r.amount,
      status: r.status,
      issuedAt: r.issued_at ?? undefined,
      dueDate: r.due_date ?? undefined,
      paidAt: r.paid_at ?? undefined,
    }));
  }

  async getChangeOrders(companyId: string, jobId?: string): Promise<ChangeOrder[]> {
    const { rows } = await this.pool.query<ChangeOrderRow>(
      `select c.* from change_orders c join jobs j on j.id = c.job_id
       where j.company_id = $1 and ($2::text is null or c.job_id = $2) order by c.created_at desc`,
      [companyId, jobId ?? null],
    );
    return rows.map(mapChangeOrder);
  }
}
