/**
 * Typed HTTP client for the Evolv API (apps/api). One namespace per port, same method names
 * as the port interfaces in @evolv/contracts, so swapping the transport never touches a component.
 */
import type {
  Agent,
  AgentRun,
  Approval,
  Brief,
  ChangeOrder,
  Commitment,
  Company,
  CostCode,
  CostDay,
  DateRange,
  DeliveryChannel,
  DeliveryReceipt,
  Equipment,
  FieldTicket,
  Integration,
  Invoice,
  Job,
  OrchestratorSummary,
  QAPair,
  SafetyEvent,
} from "@evolv/contracts/types";
import type { ResolveApprovalInput } from "@evolv/contracts/ports";
import { rangeEndingAt } from "@evolv/contracts/dates";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  // Nest serializes non-object return values (e.g. a bare string) as plain text, not JSON.
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) return res.json();
  return (await res.text()) as unknown as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) search.set(k, v);
  return search.toString();
}

interface CostDayQuery {
  companyId: string;
  jobId?: string;
  range: DateRange;
}

export const apiClient = {
  projects: {
    listCompanies: () => get<Company[]>("/projects/companies"),
    getCompany: (id: string) => get<Company | undefined>(`/projects/companies/${id}`),
    latestDate: (companyId: string) => get<string>(`/projects/companies/${companyId}/latest-date`),
    listJobs: (companyId: string) => get<Job[]>(`/projects/jobs?${qs({ companyId })}`),
    getCostCodes: (companyId: string, jobId?: string) => get<CostCode[]>(`/projects/cost-codes?${qs({ companyId, jobId })}`),
    getCostDays: (q: CostDayQuery) => get<CostDay[]>(`/projects/cost-days?${qs({ companyId: q.companyId, jobId: q.jobId, from: q.range.from, to: q.range.to })}`),
  },
  billing: {
    getFieldTickets: (companyId: string, jobId?: string) => get<FieldTicket[]>(`/billing/tickets?${qs({ companyId, jobId })}`),
    getInvoices: (companyId: string, jobId?: string) => get<Invoice[]>(`/billing/invoices?${qs({ companyId, jobId })}`),
    getChangeOrders: (companyId: string, jobId?: string) => get<ChangeOrder[]>(`/billing/change-orders?${qs({ companyId, jobId })}`),
  },
  resources: {
    getEquipment: (companyId: string, jobId?: string) => get<Equipment[]>(`/resources/equipment?${qs({ companyId, jobId })}`),
    getCommitments: (companyId: string, jobId?: string) => get<Commitment[]>(`/resources/commitments?${qs({ companyId, jobId })}`),
  },
  safety: {
    getSafetyEvents: (companyId: string, jobId?: string) => get<SafetyEvent[]>(`/safety/events?${qs({ companyId, jobId })}`),
  },
  narrator: {
    getBrief: (companyId: string, date: string) => get<Brief | undefined>(`/narrator/brief?${qs({ companyId, date })}`),
    listBriefs: (companyId: string) => get<Brief[]>(`/narrator/briefs?${qs({ companyId })}`),
    suggestedQuestions: (companyId: string) => get<string[]>(`/narrator/suggested-questions?${qs({ companyId })}`),
    ask: (companyId: string, date: string, question: string) => post<QAPair>("/narrator/ask", { companyId, date, question }),
  },
  notifier: {
    send: (channel: DeliveryChannel, to: string[], subject: string, body: string) => post<DeliveryReceipt>("/notifier/send", { channel, to, subject, body }),
    lastDelivery: (companyId: string) => get<DeliveryReceipt | undefined>(`/notifier/last-delivery?${qs({ companyId })}`),
  },
  agents: {
    listAgents: () => get<Agent[]>("/agents"),
    listRuns: (companyId: string, agentId?: string) => get<AgentRun[]>(`/agents/runs?${qs({ companyId, agentId })}`),
    getRun: (runId: string) => get<AgentRun | undefined>(`/agents/runs/${runId}`),
    lastCycle: (companyId: string) => get<OrchestratorSummary>(`/agents/last-cycle?${qs({ companyId })}`),
    runNow: (companyId: string, agentId: string) => post<AgentRun>("/agents/run-now", { companyId, agentId }),
  },
  approvals: {
    listApprovals: (companyId: string) => get<Approval[]>(`/approvals?${qs({ companyId })}`),
    resolve: (input: ResolveApprovalInput) => post<Approval>(`/approvals/${input.approvalId}/resolve`, { status: input.status, editedAction: input.editedAction }),
  },
  integrations: {
    listIntegrations: (companyId: string) => get<Integration[]>(`/integrations?${qs({ companyId })}`),
  },
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
