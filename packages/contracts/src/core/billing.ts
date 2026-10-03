import type { ChangeOrder, CostCode, CostDay, FieldTicket, Invoice, Job } from "../domain";
import { daysBetween } from "./dates";
import type { JobEvm } from "./evm";

export const TICKET_RULES = {
  /** An unsigned ticket this old is at risk of dispute: the client has forgotten the work. */
  unsignedDays: 3,
  /** A signed ticket this old that has not gone to the client's billing system is leaking cash flow. */
  unsubmittedDays: 5,
};

export interface TicketLeak {
  unsigned: FieldTicket[];
  unsubmitted: FieldTicket[];
  disputed: FieldTicket[];
  /** Dollar value across all three buckets. */
  atRisk: number;
}

export function ticketAgeDays(t: FieldTicket, asOf: string): number {
  return daysBetween(t.date, asOf);
}

/** Tickets that are stuck somewhere between the field and the client's invoice system. */
export function ticketLeakage(tickets: FieldTicket[], asOf: string): TicketLeak {
  const unsigned = tickets.filter((t) => t.status === "open" && ticketAgeDays(t, asOf) >= TICKET_RULES.unsignedDays);
  const unsubmitted = tickets.filter((t) => t.status === "signed" && ticketAgeDays(t, asOf) >= TICKET_RULES.unsubmittedDays);
  const disputed = tickets.filter((t) => t.status === "disputed");
  const atRisk = [...unsigned, ...unsubmitted, ...disputed].reduce((a, t) => a + t.amount, 0);
  return { unsigned, unsubmitted, disputed, atRisk };
}

export interface TicketPipelineRow {
  status: FieldTicket["status"];
  count: number;
  amount: number;
}

const PIPELINE_ORDER: FieldTicket["status"][] = ["open", "signed", "submitted", "approved", "disputed", "paid"];

export function ticketPipeline(tickets: FieldTicket[]): TicketPipelineRow[] {
  return PIPELINE_ORDER.map((status) => {
    const rows = tickets.filter((t) => t.status === status);
    return { status, count: rows.length, amount: rows.reduce((a, t) => a + t.amount, 0) };
  });
}

export interface BillingLag {
  /** Contract revenue earned so far: contract value x percent complete. */
  earned: number;
  /** Invoices actually issued (drafts do not count). */
  billed: number;
  lag: number;
  lagPct: number;
}

export function billingLag(job: Job, evm: JobEvm, invoices: Invoice[]): BillingLag {
  const earned = job.contractValue * evm.pctComplete;
  const billed = invoices.filter((i) => i.jobId === job.id && i.status !== "draft").reduce((a, i) => a + i.amount, 0);
  const lag = Math.max(0, earned - billed);
  return { earned, billed, lag, lagPct: earned > 0 ? lag / earned : 0 };
}

export interface Receivables {
  outstanding: number;
  overdue: number;
  overdueCount: number;
}

export function receivables(invoices: Invoice[], asOf: string): Receivables {
  const open = invoices.filter((i) => i.status === "issued" || i.status === "overdue");
  const overdue = open.filter((i) => i.status === "overdue" || (i.dueDate !== undefined && i.dueDate < asOf));
  return {
    outstanding: open.reduce((a, i) => a + i.amount, 0),
    overdue: overdue.reduce((a, i) => a + i.amount, 0),
    overdueCount: overdue.length,
  };
}

export interface MissingChangeOrder {
  jobId: string;
  codeId: string;
  code: string;
  name: string;
  hours: number;
  cost: number;
  firstDate: string;
  lastDate: string;
}

/**
 * Cost booked to an extra-work code with no change order covering it: usually unbilled extra work.
 * A rejected change order does not cover the work.
 */
export function missingChangeOrders(codes: CostCode[], days: CostDay[], changeOrders: ChangeOrder[], asOf: string): MissingChangeOrder[] {
  const out: MissingChangeOrder[] = [];
  for (const code of codes) {
    if (!code.extra) continue;
    if (changeOrders.some((co) => co.codeId === code.id && co.status !== "rejected")) continue;
    const rows = days.filter((d) => d.codeId === code.id && d.date <= asOf && d.cost > 0);
    if (!rows.length) continue;
    const dates = rows.map((r) => r.date).sort();
    out.push({
      jobId: code.jobId,
      codeId: code.id,
      code: code.code,
      name: code.name,
      hours: rows.reduce((a, r) => a + r.hours, 0),
      cost: rows.reduce((a, r) => a + r.cost, 0),
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
    });
  }
  return out.sort((a, b) => b.cost - a.cost);
}
