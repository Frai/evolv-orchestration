/**
 * The demo "backend": the nine ports from @evolv/contracts, implemented over the in-browser store.
 * Swapping one of these for a real connector (Vista, FieldCap, OpenInvoice, ...) is the same
 * one-class change it would be on a server; the UI only ever sees the port shapes.
 */
import type {
  AgentRunner,
  ApprovalQueue,
  BillingSource,
  CostDayQuery,
  IntegrationRegistry,
  Narrator,
  Notifier,
  ProjectSource,
  ResolveApprovalInput,
  ResourceSource,
  SafetySource,
} from "@evolv/contracts/ports";
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
import { money } from "@evolv/contracts/format";
import { getStore } from "./store";

const jobIdsOf = (companyId: string): Set<string> => new Set(getStore().fx.jobs.filter((j) => j.companyId === companyId).map((j) => j.id));
const inJob = (ids: Set<string>, jobId: string | undefined, rowJob: string) => ids.has(rowJob) && (!jobId || rowJob === jobId);

export const projects: ProjectSource = {
  async listCompanies(): Promise<Company[]> {
    return [...getStore().fx.companies].sort((a, b) => a.name.localeCompare(b.name));
  },
  async getCompany(id: string): Promise<Company | undefined> {
    return getStore().fx.companies.find((c) => c.id === id);
  },
  async latestDate(companyId: string): Promise<string> {
    const ids = jobIdsOf(companyId);
    let latest = "";
    for (const d of getStore().fx.costDays) if (ids.has(d.jobId) && d.date > latest) latest = d.date;
    if (!latest) throw new Error(`No cost data for company ${companyId}`);
    return latest;
  },
  async listJobs(companyId: string): Promise<Job[]> {
    return getStore().fx.jobs.filter((j) => j.companyId === companyId).sort((a, b) => b.contractValue - a.contractValue);
  },
  async getCostCodes(companyId: string, jobId?: string): Promise<CostCode[]> {
    const ids = jobIdsOf(companyId);
    return getStore().fx.codes.filter((c) => inJob(ids, jobId, c.jobId));
  },
  async getCostDays(q: CostDayQuery): Promise<CostDay[]> {
    const ids = jobIdsOf(q.companyId);
    return getStore().fx.costDays.filter((d) => inJob(ids, q.jobId, d.jobId) && d.date >= q.range.from && d.date <= q.range.to);
  },
};

export const billing: BillingSource = {
  async getFieldTickets(companyId: string, jobId?: string): Promise<FieldTicket[]> {
    return getStore()
      .fx.tickets.filter((t) => t.companyId === companyId && (!jobId || t.jobId === jobId))
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  },
  async getInvoices(companyId: string, jobId?: string): Promise<Invoice[]> {
    const ids = jobIdsOf(companyId);
    return getStore().fx.invoices.filter((i) => inJob(ids, jobId, i.jobId)).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  },
  async getChangeOrders(companyId: string, jobId?: string): Promise<ChangeOrder[]> {
    const ids = jobIdsOf(companyId);
    return getStore().fx.changeOrders.filter((c) => inJob(ids, jobId, c.jobId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
};

export const resources: ResourceSource = {
  async getEquipment(companyId: string, jobId?: string): Promise<Equipment[]> {
    const ids = jobIdsOf(companyId);
    return getStore().fx.equipment.filter((e) => inJob(ids, jobId, e.jobId)).sort((a, b) => a.jobId.localeCompare(b.jobId) || a.name.localeCompare(b.name));
  },
  async getCommitments(companyId: string, jobId?: string): Promise<Commitment[]> {
    const ids = jobIdsOf(companyId);
    return getStore().fx.commitments.filter((c) => inJob(ids, jobId, c.jobId)).sort((a, b) => a.needDate.localeCompare(b.needDate));
  },
};

export const safety: SafetySource = {
  async getSafetyEvents(companyId: string, jobId?: string): Promise<SafetyEvent[]> {
    const ids = jobIdsOf(companyId);
    return getStore().fx.safety.filter((s) => inJob(ids, jobId, s.jobId)).sort((a, b) => b.date.localeCompare(a.date));
  },
};

export const narrator: Narrator = {
  async getBrief(companyId: string, date: string): Promise<Brief | undefined> {
    return getStore().fx.briefs.find((b) => b.companyId === companyId && b.date === date);
  },
  async listBriefs(companyId: string): Promise<Brief[]> {
    return getStore().fx.briefs.filter((b) => b.companyId === companyId).sort((a, b) => b.date.localeCompare(a.date));
  },
  async suggestedQuestions(companyId: string): Promise<string[]> {
    return getStore().fx.qa.filter((q) => q.companyId === companyId).map((q) => q.question);
  },
  async ask(companyId: string, date: string, question: string): Promise<QAPair> {
    const { fx } = getStore();
    const pairs = fx.qa.filter((q) => q.companyId === companyId);
    const words = question
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    let best: { pair: QAPair; score: number } | null = null;
    for (const pair of pairs) {
      let score = 0;
      for (const k of pair.keywords) {
        const kw = k.toLowerCase();
        if (kw.includes(" ")) {
          if (question.toLowerCase().includes(kw)) score += 2;
        } else if (words.includes(kw)) score += 1;
      }
      if (question.trim().toLowerCase() === pair.question.toLowerCase()) score += 10;
      if (!best || score > best.score) best = { pair, score };
    }
    if (best && best.score > 0) return best.pair;

    const name = fx.companies.find((c) => c.id === companyId)?.name ?? "this company";
    return {
      companyId,
      question,
      keywords: [],
      answer: `I can answer questions about ${name}'s margin, cost codes, billing, labour and materials for ${date}. Try one of: ${pairs
        .slice(0, 3)
        .map((p) => `"${p.question}"`)
        .join(", ")}.`,
    };
  },
};

export const notifier: Notifier = {
  async send(channel: DeliveryChannel, to: string[]): Promise<DeliveryReceipt> {
    const sentAt = new Date().toISOString();
    // The Notifier.send() port has no companyId, so a live send is logged without one.
    getStore().deliveries.push({ companyId: "", channel, sentAt, to });
    return { channel, to, sentAt };
  },
  async lastDelivery(companyId: string): Promise<DeliveryReceipt | undefined> {
    const latest = getStore()
      .deliveries.filter((d) => d.companyId === companyId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    return latest ? { channel: latest.channel, sentAt: latest.sentAt, to: latest.to } : undefined;
  },
};

export const agents: AgentRunner = {
  async listAgents(): Promise<Agent[]> {
    return [...getStore().fx.agents].sort((a, b) => a.name.localeCompare(b.name));
  },
  async listRuns(companyId: string, agentId?: string): Promise<AgentRun[]> {
    return getStore().fx.runs.filter((r) => r.companyId === companyId && (!agentId || r.agentId === agentId));
  },
  async getRun(runId: string): Promise<AgentRun | undefined> {
    return getStore().fx.runs.find((r) => r.id === runId);
  },
  async lastCycle(companyId: string): Promise<OrchestratorSummary> {
    const runs = await agents.listRuns(companyId);
    const latest = runs.reduce((a, r) => (r.startedAt.slice(0, 10) > a ? r.startedAt.slice(0, 10) : a), "");
    const cycle = runs.filter((r) => r.startedAt.slice(0, 10) === latest).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    return {
      date: latest,
      agents: new Set(cycle.map((r) => r.agentId)).size,
      steps: cycle.reduce((a, r) => a + r.steps.length, 0),
      approvalsPending: cycle.filter((r) => r.status === "needs_approval").length,
      errors: cycle.filter((r) => r.status === "error").length,
      runs: cycle,
    };
  },
  async runNow(companyId: string, agentId: string): Promise<AgentRun> {
    // Placeholder until the real agentic loop lands: returns the most recent historical run for this
    // agent and company so the UI is exercisable now.
    const latest = (await agents.listRuns(companyId, agentId)).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (latest) return latest;
    const now = new Date().toISOString();
    return {
      id: `${companyId}:${now}:${agentId}`,
      agentId,
      companyId,
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      status: "error",
      goal: "Run this agent live.",
      steps: [],
      outcome: { kind: "error", summary: "Live runs aren't wired up for this agent yet." },
    };
  },
};

export const integrations: IntegrationRegistry = {
  async listIntegrations(companyId: string): Promise<Integration[]> {
    return getStore().fx.integrations.find((i) => i.companyId === companyId)?.integrations ?? [];
  },
};

// ---------------------------------------------------------------------------
// Approvals. The one real write: approving a Change-Order Catcher draft adds a pending change order for
// the extra-work cost code, and the "no change order on file" signal then clears on the next load.
// Every other agent drafts only: a person sends the email, the billing package or the reminder, and
// nothing writes back to accounting, payroll or safety systems.
// ---------------------------------------------------------------------------

/** Adds the change order for an approved Change-Order Catcher draft and returns the confirmation text. */
function executeChangeOrder(approval: Approval): string {
  const { fx } = getStore();
  const code = approval.refId ? fx.codes.find((c) => c.id === approval.refId) : undefined;
  const job = code && fx.jobs.find((j) => j.id === code.jobId);
  if (!code || !job) return approval.confirmation;

  const amount = approval.amount ?? 0;
  const seq = fx.changeOrders.filter((c) => c.jobId === job.id).length + 1;
  const now = new Date().toISOString();
  const co: ChangeOrder = {
    id: `${job.id}:co-${seq}`,
    jobId: job.id,
    number: `CO-${String(seq).padStart(3, "0")}`,
    title: `Extra work: ${code.name}`,
    amount,
    status: "pending", // submitted to the client, not yet approved by them
    codeId: code.id,
    createdAt: now,
    submittedAt: now,
  };
  fx.changeOrders.push(co);
  return `Change order ${co.number} for ${money(amount)} submitted to ${job.client} with backup attached. Awaiting their approval.`;
}

export const approvals: ApprovalQueue = {
  async listApprovals(companyId: string): Promise<Approval[]> {
    return getStore()
      .fx.approvals.filter((a) => a.companyId === companyId)
      .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt))
      .map((a) => ({ ...a }));
  },
  async resolve(input: ResolveApprovalInput): Promise<Approval> {
    const approval = getStore().fx.approvals.find((a) => a.id === input.approvalId);
    if (!approval) throw new Error(`Approval ${input.approvalId} not found`);
    if (approval.status !== "pending") return { ...approval }; // already decided; resolving twice must not write twice

    const action = input.editedAction ?? approval.action;
    if (input.status === "approved" && approval.agentId === "change-order-catcher") {
      approval.confirmation = executeChangeOrder({ ...approval, action });
    }
    approval.status = input.status;
    approval.resolvedAt = new Date().toISOString();
    approval.action = action;
    return { ...approval };
  },
};
