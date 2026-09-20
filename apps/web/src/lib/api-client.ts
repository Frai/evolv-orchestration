/**
 * Typed HTTP client for the Evolv API (apps/api). Shaped identically to the old
 * in-process `adapters` object (same 9 namespaces, same method names) so every
 * component only needed its import swapped, not its call shape.
 */
import type {
  Agent,
  AgentRun,
  Approval,
  Brief,
  DateRange,
  DeliveryChannel,
  DeliveryReceipt,
  Integration,
  ItemSales,
  LabourDay,
  Location,
  MenuItem,
  OrchestratorSummary,
  QAPair,
  SalesDay,
  StockLevel,
} from "@evolv/contracts/types";
import type { CostSummary } from "@evolv/contracts/ports";

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

interface SalesQuery {
  locationId: string;
  outletId?: string;
  range: DateRange;
}

interface LabourQuery {
  locationId: string;
  outletId?: string;
  range: DateRange;
}

export const apiClient = {
  sales: {
    listLocations: () => get<Location[]>("/sales/locations"),
    getLocation: (id: string) => get<Location | undefined>(`/sales/locations/${id}`),
    latestDate: (locationId: string) => get<string>(`/sales/locations/${locationId}/latest-date`),
    getSalesDays: (q: SalesQuery) => get<SalesDay[]>(`/sales/days?${qs({ locationId: q.locationId, outletId: q.outletId, from: q.range.from, to: q.range.to })}`),
    getMenu: (locationId: string, outletId?: string) => get<MenuItem[]>(`/sales/menu?${qs({ locationId, outletId })}`),
    getItemSales: (q: SalesQuery) => get<ItemSales[]>(`/sales/item-sales?${qs({ locationId: q.locationId, outletId: q.outletId, from: q.range.from, to: q.range.to })}`),
  },
  labour: {
    getLabourDays: (q: LabourQuery) => get<LabourDay[]>(`/labour/days?${qs({ locationId: q.locationId, outletId: q.outletId, from: q.range.from, to: q.range.to })}`),
  },
  inventory: {
    getStockLevels: (locationId: string) => get<StockLevel[]>(`/inventory/stock?${qs({ locationId })}`),
  },
  accounting: {
    getCostSummary: (locationId: string, range: DateRange) => get<CostSummary>(`/accounting/cost-summary?${qs({ locationId, from: range.from, to: range.to })}`),
  },
  narrator: {
    getBrief: (locationId: string, date: string) => get<Brief | undefined>(`/narrator/brief?${qs({ locationId, date })}`),
    listBriefs: (locationId: string) => get<Brief[]>(`/narrator/briefs?${qs({ locationId })}`),
    suggestedQuestions: (locationId: string) => get<string[]>(`/narrator/suggested-questions?${qs({ locationId })}`),
    ask: (locationId: string, date: string, question: string) => post<QAPair>("/narrator/ask", { locationId, date, question }),
  },
  notifier: {
    send: (channel: DeliveryChannel, to: string[], subject: string, body: string) => post<DeliveryReceipt>("/notifier/send", { channel, to, subject, body }),
    lastDelivery: (locationId: string) => get<DeliveryReceipt | undefined>(`/notifier/last-delivery?${qs({ locationId })}`),
  },
  agents: {
    listAgents: () => get<Agent[]>("/agents"),
    listRuns: (locationId: string, agentId?: string) => get<AgentRun[]>(`/agents/runs?${qs({ locationId, agentId })}`),
    getRun: (runId: string) => get<AgentRun | undefined>(`/agents/runs/${runId}`),
    lastCycle: (locationId: string) => get<OrchestratorSummary>(`/agents/last-cycle?${qs({ locationId })}`),
  },
  approvals: {
    listApprovals: (locationId: string) => get<Approval[]>(`/approvals?${qs({ locationId })}`),
  },
  integrations: {
    listIntegrations: (locationId: string) => get<Integration[]>(`/integrations?${qs({ locationId })}`),
  },
};
