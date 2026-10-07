/**
 * The web app's data layer. The demo is entirely client-side: every namespace is one of the ports from
 * @evolv/contracts, implemented over an in-browser fixture world (src/demo). Nothing is fetched. To
 * point the UI at a real backend, replace these assignments with a typed fetch client that has the
 * same method names; no component changes.
 */
import type { ChangeOrder, Commitment, CostCode, CostDay, FieldTicket, Invoice, Job, SafetyEvent, Equipment } from "@evolv/contracts/types";
import { rangeEndingAt } from "@evolv/contracts/dates";
import * as backend from "@/demo/backend";

export const apiClient = {
  projects: backend.projects,
  billing: backend.billing,
  resources: backend.resources,
  safety: backend.safety,
  narrator: backend.narrator,
  notifier: backend.notifier,
  agents: backend.agents,
  approvals: backend.approvals,
  integrations: backend.integrations,
};

/** Everything the dashboards compute over for one company: the canonical model, as of one date. */
export interface Snapshot {
  companyId: string;
  asOf: string;
  jobs: Job[];
  codes: CostCode[];
  costDays: CostDay[];
  tickets: FieldTicket[];
  invoices: Invoice[];
  changeOrders: ChangeOrder[];
  equipment: Equipment[];
  commitments: Commitment[];
  safety: SafetyEvent[];
}

/** Loads the full snapshot for a company: 90 days of job cost plus the live ticket, billing, fleet and safety state. */
export async function loadSnapshot(companyId: string, asOf: string): Promise<Snapshot> {
  const range = rangeEndingAt(asOf, 90);
  const [jobs, codes, costDays, tickets, invoices, changeOrders, equipment, commitments, safety] = await Promise.all([
    apiClient.projects.listJobs(companyId),
    apiClient.projects.getCostCodes(companyId),
    apiClient.projects.getCostDays({ companyId, range }),
    apiClient.billing.getFieldTickets(companyId),
    apiClient.billing.getInvoices(companyId),
    apiClient.billing.getChangeOrders(companyId),
    apiClient.resources.getEquipment(companyId),
    apiClient.resources.getCommitments(companyId),
    apiClient.safety.getSafetyEvents(companyId),
  ]);
  return { companyId, asOf, jobs, codes, costDays, tickets, invoices, changeOrders, equipment, commitments, safety };
}
