/**
 * Seeded fixture generator, shared by the API's in-memory store (src/store/store.service.ts) and the
 * local-inspection script (generate-fixtures.ts) so both produce the exact same deterministic dataset.
 */
import type {
  Agent,
  AgentRun,
  Alert,
  Approval,
  Brief,
  ChangeOrder,
  Commitment,
  Company,
  CostCode,
  CostDay,
  DeliveryReceipt,
  Equipment,
  FieldTicket,
  Integration,
  Invoice,
  Job,
  QAPair,
  SafetyEvent,
} from "@evolv/contracts/types";
import { addDays, todayISO, weekday } from "@evolv/contracts/dates";
import { buildBriefInput } from "@evolv/contracts/brief";
import { detectAlerts, type AlertInput } from "@evolv/contracts/alerts";
import { COMPANIES, JOBS } from "./world";
import { generateJobCost } from "./cost";
import { generateChangeOrders, generateCommitments, generateEquipment, generateInvoices, generateSafety, generateTickets } from "./ops";
import { composeBrief, generateQA } from "./narrate";
import { AGENTS, generateRuns, localIso } from "./agents";
import { integrationsFor } from "./integrations";

const HISTORY_DAYS = 90;
const BRIEF_DAYS = 10;

export interface DeliveryFixture {
  companyId: string;
  channel: DeliveryReceipt["channel"];
  sentAt: string;
  to: string[];
}

export interface IntegrationFixture {
  companyId: string;
  integrations: Integration[];
}

export interface FixtureSet {
  meta: { generatedAt: string; today: string; asOf: string; dates: string[] };
  companies: Company[];
  jobs: Job[];
  codes: CostCode[];
  costDays: CostDay[];
  tickets: FieldTicket[];
  invoices: Invoice[];
  changeOrders: ChangeOrder[];
  equipment: Equipment[];
  commitments: Commitment[];
  safety: SafetyEvent[];
  briefs: Brief[];
  agents: Agent[];
  runs: AgentRun[];
  approvals: Approval[];
  integrations: IntegrationFixture[];
  qa: QAPair[];
  deliveries: DeliveryFixture[];
  /** Live signals at the as-of date, by company. Not persisted: the app recomputes them at request time. */
  alerts: Alert[];
}

export function buildFixtureSet(): FixtureSet {
  const today = process.env.NEXT_PUBLIC_FIXTURE_TODAY ?? todayISO();
  // "Yesterday" is the last day with job cost: crews book nothing on weekends, so a weekend demo shows Friday.
  let asOf = addDays(today, -1);
  while (weekday(asOf) === 0 || weekday(asOf) === 6) asOf = addDays(asOf, -1);
  const dates = Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(asOf, -(HISTORY_DAYS - 1 - i)));

  const out: FixtureSet = {
    meta: { generatedAt: new Date().toISOString(), today, asOf, dates },
    companies: COMPANIES,
    jobs: [],
    codes: [],
    costDays: [],
    tickets: [],
    invoices: [],
    changeOrders: [],
    equipment: [],
    commitments: [],
    safety: [],
    briefs: [],
    agents: AGENTS,
    runs: [],
    approvals: [],
    integrations: [],
    qa: [],
    deliveries: [],
    alerts: [],
  };

  for (const company of COMPANIES) {
    const specs = JOBS.filter((j) => j.companyId === company.id);
    const input: AlertInput = {
      company,
      date: asOf,
      jobs: [],
      codes: [],
      costDays: [],
      tickets: [],
      invoices: [],
      changeOrders: [],
      equipment: [],
      commitments: [],
      safety: [],
    };

    for (const spec of specs) {
      const cost = generateJobCost(spec, asOf);
      input.jobs.push(cost.job);
      input.codes.push(...cost.codes);
      input.costDays.push(...cost.days);
      input.invoices.push(...generateInvoices(spec, cost.job, cost.codes, cost.days, asOf));
      input.changeOrders.push(...generateChangeOrders(spec, asOf));
      input.tickets.push(...generateTickets(spec, asOf));
      input.equipment.push(...generateEquipment(spec, asOf));
      input.commitments.push(...generateCommitments(spec, asOf));
      input.safety.push(...generateSafety(spec, asOf));
    }

    const alerts = detectAlerts(input);
    const recipients = [company.owner.phone];
    const channelLabel = "WhatsApp";
    const r = generateRuns({ company, jobs: input.jobs, asOf, alerts, input, recipients, channelLabel });
    const pending = r.approvals.filter((a) => a.status === "pending").length;

    dates.slice(-BRIEF_DAYS).forEach((date, idx) => {
      const isLatest = date === asOf;
      const brief = buildBriefInput({
        company,
        date,
        jobs: input.jobs,
        codes: input.codes,
        costDays: input.costDays,
        tickets: isLatest ? input.tickets : [],
        invoices: input.invoices.filter((i) => i.status !== "draft" && i.issuedAt !== undefined && i.issuedAt <= date),
        changeOrders: input.changeOrders.filter((c) => c.createdAt.slice(0, 10) <= date),
        alerts: isLatest ? alerts : [],
      });
      if (!brief) return;
      out.briefs.push(
        composeBrief(
          { company, input: brief, variant: idx, latest: isLatest ? { alerts, pendingApprovals: pending } : undefined },
          "whatsapp",
          localIso(addDays(date, 1), 5, 45, 4 + idx),
        ),
      );
    });

    out.jobs.push(...input.jobs);
    out.codes.push(...input.codes);
    out.costDays.push(...input.costDays);
    out.tickets.push(...input.tickets);
    out.invoices.push(...input.invoices);
    out.changeOrders.push(...input.changeOrders);
    out.equipment.push(...input.equipment);
    out.commitments.push(...input.commitments);
    out.safety.push(...input.safety);
    out.runs.push(...r.runs);
    out.approvals.push(...r.approvals);
    out.alerts.push(...alerts);
    out.qa.push(...generateQA(input));
    out.deliveries.push({ companyId: company.id, channel: "whatsapp", sentAt: localIso(today, 5, 45, 4), to: recipients });
    out.integrations.push({ companyId: company.id, integrations: integrationsFor(company, localIso(today, 5, 47, 11)) });
  }

  return out;
}
