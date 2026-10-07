import type { Agent, AgentRun, AgentStep, Alert, Approval, AlertSource, Company, Job } from "@evolv/contracts/types";
import type { AlertInput } from "@evolv/contracts/alerts";
import { addDays } from "@evolv/contracts/dates";
import { missingChangeOrders } from "@evolv/contracts/billing";
import { int, money, moneyCompact, shortDate } from "@evolv/contracts/format";
import { Rng, hashSeed } from "./rng";

export const AGENTS: Agent[] = [
  {
    id: "daily-brief",
    name: "Daily Brief",
    description: "Reads yesterday's job cost and field progress, writes the margin brief, and delivers it before the morning huddle.",
    status: "active",
    schedule: "Daily at 5:45 AM",
    defaultMode: "auto",
  },
  {
    id: "margin-sentinel",
    name: "Margin Sentinel",
    description: "Tracks earned value per cost code and flags a job drifting off its budget days before the month-end report does.",
    status: "active",
    schedule: "Nightly at 11:30 PM",
    defaultMode: "ask_first",
  },
  {
    id: "labor-analyst",
    name: "Labor Analyst",
    description: "Watches hours, overtime and crew size against the estimate and proposes crew reallocation when they diverge.",
    status: "active",
    schedule: "Daily at 5:10 AM",
    defaultMode: "ask_first",
  },
  {
    id: "change-order-catcher",
    name: "Change-Order Catcher",
    description: "Spots hours and cost booked to out-of-scope work with no change order, and drafts the request with the backup attached.",
    status: "active",
    schedule: "Daily at 5:20 AM",
    defaultMode: "ask_first",
  },
  {
    id: "billing-accelerator",
    name: "Billing Accelerator",
    description: "Compares work performed with work invoiced, assembles progress billing packages, and chases unsigned or unsubmitted field tickets.",
    status: "active",
    schedule: "Daily at 5:30 AM",
    defaultMode: "ask_first",
  },
  {
    id: "materials-watcher",
    name: "Materials Watcher",
    description: "Compares vendor promise dates with the dates the schedule needs material on site, and drafts expedite requests.",
    status: "active",
    schedule: "Daily at 5:00 AM",
    defaultMode: "ask_first",
  },
  {
    id: "safety-coordinator",
    name: "Safety Coordinator",
    description: "Routes inspection findings and corrective actions to the right owner with reminders and escalation. Routes only: supervisors always make the safety decisions.",
    status: "active",
    schedule: "Daily at 6:00 AM",
    defaultMode: "ask_first",
  },
  {
    id: "equipment-dispatcher",
    name: "Equipment Dispatcher",
    description: "Watches utilization, rental burn and maintenance conflicts, and proposes moving or returning units.",
    status: "coming_soon",
    schedule: "Daily",
    defaultMode: "ask_first",
  },
  {
    id: "cash-forecaster",
    name: "Cash Forecaster",
    description: "Combines receivables aging, the payroll calendar and open commitments into an early cash-pressure warning.",
    status: "coming_soon",
    schedule: "Weekly",
    defaultMode: "auto",
  },
];

interface AgentPlan {
  sources: AlertSource[];
  steps: { title: string; tool: string; input: (n: number) => string; output: (n: number) => string }[];
}

const PLANS: Record<string, AgentPlan> = {
  "margin-sentinel": {
    sources: ["margin"],
    steps: [
      { title: "Load estimate and job cost", tool: "ProjectSource.getCostCodes", input: (n) => `${n} active jobs`, output: () => "Budget at completion per cost code" },
      { title: "Compute earned value", tool: "evm.jobEvm", input: () => "All cost codes, as of last night", output: () => "CPI, SPI and EAC per code and job" },
      { title: "Check trailing 14-day cost performance", tool: "evm.trailingCodeCpi", input: () => "Rule: sustained CPI below 0.90", output: (n) => (n ? `${n} signals over threshold` : "No code over threshold") },
    ],
  },
  "labor-analyst": {
    sources: ["labour"],
    steps: [
      { title: "Load crew hours", tool: "ProjectSource.getCostDays", input: (n) => `${n} jobs, last 7 days`, output: () => "Regular and overtime hours by cost code" },
      { title: "Compute overtime share", tool: "labour.overtimePct", input: () => "Rule: over 18% of hours", output: (n) => (n ? `${n} jobs over threshold` : "All jobs under threshold") },
    ],
  },
  "change-order-catcher": {
    sources: ["change_orders"],
    steps: [
      { title: "Find extra-work cost codes", tool: "ProjectSource.getCostCodes", input: (n) => `${n} jobs`, output: () => "Codes outside the original estimate" },
      { title: "Match against change orders on file", tool: "BillingSource.getChangeOrders", input: () => "Pending, approved and rejected", output: (n) => (n ? `${n} uncovered` : "All covered") },
    ],
  },
  "billing-accelerator": {
    sources: ["billing", "tickets"],
    steps: [
      { title: "Compare earned work with invoiced work", tool: "BillingSource.getInvoices", input: (n) => `${n} jobs, 14-day billing cycle`, output: () => "Earned vs invoiced per job" },
      { title: "Scan field tickets by status", tool: "BillingSource.getFieldTickets", input: () => "Open, signed, submitted, disputed", output: (n) => (n ? `${n} items stuck` : "Nothing stuck") },
    ],
  },
  "materials-watcher": {
    sources: ["materials"],
    steps: [
      { title: "Load open commitments", tool: "ResourceSource.getCommitments", input: (n) => `${n} jobs`, output: () => "Promised vs needed dates" },
      { title: "Check float against need dates", tool: "resources.materialsAtRisk", input: () => "Rule: promised after need date", output: (n) => (n ? `${n} commitments at risk` : "All on time") },
    ],
  },
  "safety-coordinator": {
    sources: ["safety"],
    steps: [
      { title: "Load open corrective actions", tool: "SafetySource.getSafetyEvents", input: (n) => `${n} jobs`, output: () => "Findings, near-misses and incidents" },
      { title: "Check due dates", tool: "resources.overdueSafety", input: () => "Rule: open past due date", output: (n) => (n ? `${n} overdue, routed to owner` : "None overdue") },
    ],
  },
};

const APPROVAL_AGENT: Record<string, string> = {
  margin: "margin-sentinel",
  labour: "labor-analyst",
  change_orders: "change-order-catcher",
  billing: "billing-accelerator",
  tickets: "billing-accelerator",
  materials: "materials-watcher",
  safety: "safety-coordinator",
};

/** Local ISO timestamp for Alberta (MDT in the demo window). */
export function localIso(date: string, hh: number, mm: number, ss = 0): string {
  return `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}-06:00`;
}

function finish(startedAt: string, steps: AgentStep[]): { finishedAt: string; durationMs: number } {
  const total = steps.reduce((a, s) => a + s.durationMs, 0) + 120;
  return { finishedAt: new Date(new Date(startedAt).getTime() + total).toISOString(), durationMs: total };
}

export interface RunContext {
  company: Company;
  jobs: Job[];
  asOf: string;
  alerts: Alert[];
  input: AlertInput;
  recipients: string[];
  channelLabel: string;
}

export interface RunOutput {
  runs: AgentRun[];
  approvals: Approval[];
}

const RUN_DAYS = 7;
const START_MINUTE: Record<string, [number, number]> = {
  "materials-watcher": [5, 0],
  "labor-analyst": [5, 10],
  "change-order-catcher": [5, 20],
  "billing-accelerator": [5, 30],
  "daily-brief": [5, 45],
  "safety-coordinator": [6, 0],
  "margin-sentinel": [23, 30],
};

export function generateRuns(c: RunContext): RunOutput {
  const rng = new Rng(hashSeed(`runs:${c.company.id}`));
  const { company, asOf, alerts } = c;
  const runs: AgentRun[] = [];
  const approvals = buildApprovals(c);
  const jobName = new Map(c.jobs.map((j) => [j.id, j.name]));
  const ms = (a: number, b: number) => rng.int(a, b);
  const step = (index: number, title: string, tool: string, inputSummary: string, outputSummary: string, durationMs: number): AgentStep => ({
    index,
    title,
    tool,
    inputSummary,
    outputSummary,
    durationMs,
    status: "ok",
  });

  const dates = Array.from({ length: RUN_DAYS }, (_, i) => addDays(asOf, -(RUN_DAYS - 1 - i)));
  for (const date of dates) {
    const isLatest = date === asOf;
    const runDate = addDays(date, 1);
    const daysBack = RUN_DAYS - 1 - dates.indexOf(date);

    // Daily Brief
    {
      const startedAt = localIso(runDate, 5, 45, ms(0, 40));
      const steps: AgentStep[] = [
        step(1, "Read job cost and field progress", "ProjectSource.getCostDays", `${c.jobs.length} jobs, 90 days`, `Cost days through ${date}`, ms(380, 720)),
        step(2, "Compute earned value and signals", "evm.jobEvm", "All cost codes", `${alerts.filter((a) => a.severity !== "info").length} signals above info`, ms(220, 480)),
        step(3, "Write the brief", "Narrator.compose", "Margin, cost drivers, cash, labour", "4 to 5 short paragraphs, numbers first", ms(1100, 2300)),
        step(4, "Deliver", "Notifier.send", c.channelLabel, `Sent to ${c.recipients[0]}`, ms(240, 520)),
      ];
      runs.push({
        id: `${company.id}:${date}:daily-brief`,
        agentId: "daily-brief",
        companyId: company.id,
        startedAt,
        ...finish(startedAt, steps),
        status: "success",
        goal: "Write and deliver the daily margin brief.",
        steps,
        outcome: { kind: "brief_sent", summary: `Brief for ${date} sent via ${c.channelLabel}.` },
      });
    }

    for (const agent of AGENTS) {
      const plan = PLANS[agent.id];
      if (!plan) continue;
      const [hh, mm] = START_MINUTE[agent.id];
      const startedAt = localIso(agent.id === "margin-sentinel" ? date : runDate, hh, mm, ms(0, 40));
      const mine = alerts.filter((a) => plan.sources.includes(a.source));
      const hit = isLatest ? mine : daysBack <= 3 ? mine.filter((a) => a.severity === "critical") : [];
      const pending = isLatest ? approvals.filter((a) => a.agentId === agent.id && a.status === "pending") : [];

      // One planted error: a late export, recovered on retry.
      const isError = company.id === "peace-river-oilfield" && agent.id === "billing-accelerator" && daysBack === 4;

      const steps: AgentStep[] = plan.steps.map((s, i) => ({
        index: i + 1,
        title: s.title,
        tool: s.tool,
        inputSummary: s.input(c.jobs.length),
        outputSummary: s.output(hit.length),
        durationMs: ms(180, 900),
        status: "ok" as const,
      }));
      if (isError) {
        steps[1] = { ...steps[1], status: "error", outputSummary: "FieldCap export had not arrived by 05:30", durationMs: 30_000 };
        steps.push(step(3, "Retry and flag staleness", "BillingSource.getFieldTickets", "Retry at 06:15", "Succeeded on retry; numbers marked as of 06:15", ms(900, 1400)));
      }
      if (pending.length) {
        steps.push(step(steps.length + 1, "Draft action for approval", "ApprovalQueue.propose", pending[0].title, "Queued for your approval", ms(120, 300)));
      }

      let status: AgentRun["status"] = "success";
      let outcome: AgentRun["outcome"] = { kind: "no_action", summary: "Nothing over threshold. No action needed." };
      if (isError) {
        status = "error";
        outcome = { kind: "error", summary: "Field-ticket export arrived late. Ran again at 06:15 and the numbers are marked as of then." };
      } else if (pending.length) {
        status = "needs_approval";
        outcome = { kind: "approval_requested", summary: pending.map((p) => p.title).join("; ") };
      } else if (hit.length) {
        outcome = { kind: "alert_raised", summary: isLatest ? hit[0].title : `Still open: ${hit[0].title}` };
      }
      runs.push({
        id: `${company.id}:${date}:${agent.id}`,
        agentId: agent.id,
        companyId: company.id,
        startedAt,
        ...finish(startedAt, steps),
        status,
        goal: agent.description,
        steps,
        outcome,
      });
    }
  }
  void jobName;
  return { runs, approvals };
}

// ---------------------------------------------------------------------------
// Approvals: one proposal per (agent, source), drawn from the live signals
// ---------------------------------------------------------------------------

/** First dollar amount in a formatted evidence value, e.g. "$375,324 (38%)" gives 375324. */
function parseMoney(value: string | undefined): number | undefined {
  const m = value?.match(/\$([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : undefined;
}

function buildApprovals(c: RunContext): Approval[] {
  const { company, asOf, alerts, input } = c;
  const jobById = new Map(c.jobs.map((j) => [j.id, j]));
  const out: Approval[] = [];
  const seen = new Set<string>();
  const missing = missingChangeOrders(input.codes, input.costDays, input.changeOrders, asOf);

  for (const a of alerts) {
    const agentId = APPROVAL_AGENT[a.source];
    if (!agentId || a.severity === "info" || seen.has(`${agentId}:${a.source}`)) continue;
    seen.add(`${agentId}:${a.source}`);
    const job = a.jobId ? jobById.get(a.jobId) : undefined;
    const jobLabel = job?.name ?? "the job";
    const id = `${company.id}:${asOf}:${agentId}:${a.source}`;
    const base = {
      id,
      companyId: company.id,
      agentId,
      runId: `${company.id}:${asOf}:${agentId}`,
      evidence: a.evidence.slice(0, 4).map((e) => ({ label: e.label, value: e.value, href: a.href })),
      status: "pending" as const,
      proposedAt: localIso(addDays(asOf, 1), 5, 10 + out.length, 20),
    };

    switch (a.source) {
      case "margin":
        out.push({
          ...base,
          title: `Hold a cost review on ${jobLabel}`,
          summary: a.detail,
          action: `Book a 30-minute cost review this week with ${job?.pm ?? "the project manager"} and the superintendent. Agenda: the cost codes running over, whether the remaining scope needs re-planning, and whether any of it should be re-priced with the client.`,
          confirmation: `Cost review invite sent to ${job?.pm ?? "the project manager"} and the superintendent for Thursday 9:00 AM.`,
        });
        break;
      case "labour":
        out.push({
          ...base,
          title: `Reallocate crew on ${jobLabel}`,
          summary: a.detail,
          action: `Propose adding one crew to the codes driving the overtime and capping weekly overtime at 15% of hours on ${jobLabel}. The superintendent confirms the crew move before it goes to the foreman.`,
          confirmation: `Crew reallocation proposal sent to the superintendent for ${jobLabel}. No schedule is changed until they confirm.`,
        });
        break;
      case "change_orders": {
        const m = missing.find((x) => x.jobId === a.jobId);
        if (!m) break;
        const amount = Math.round((m.cost * 1.12) / 100) * 100;
        out.push({
          ...base,
          title: `Change order request: ${m.name}`,
          summary: `${int(m.hours)} hours and ${money(m.cost)} booked to ${m.code} since ${shortDate(m.firstDate)} with no change order on file. Draft request is ${money(amount)} including 12% markup.`,
          amount,
          refId: m.codeId,
          action: `Submit a change order to ${job?.client ?? "the client"} for ${m.name} on ${jobLabel}: ${money(amount)} (${money(m.cost)} cost plus 12% markup). Attach the daily time entries and foreman notes from ${shortDate(m.firstDate)} to ${shortDate(m.lastDate)} as backup.`,
          confirmation: `Change order drafted for ${money(amount)} and sent to ${job?.client ?? "the client"} with backup attached.`,
        });
        break;
      }
      case "billing":
        out.push({
          ...base,
          title: `Send progress billing package: ${jobLabel}`,
          summary: a.detail,
          amount: parseMoney(a.evidence.find((e) => e.label === "Unbilled")?.value),
          action: `Assemble the progress billing package for ${jobLabel} from approved quantities and daily reports, and send it to the controller for review before it goes to ${job?.client ?? "the client"}.`,
          confirmation: `Billing package for ${jobLabel} sent to the controller. Nothing goes to the client until they approve.`,
        });
        break;
      case "tickets":
        out.push({
          ...base,
          title: `Chase stuck field tickets`,
          summary: a.detail,
          action: `Send the foreman a list of unsigned tickets to get signed at the next site visit, submit the signed tickets to the client's billing system, and attach backup to the disputed ones.`,
          confirmation: `Ticket follow-up list sent to the operations coordinator and the foremen.`,
        });
        break;
      case "materials": {
        out.push({
          ...base,
          title: `Expedite: ${a.title.split(" lands ")[0]}`,
          summary: a.detail,
          action: `Email the vendor asking for a partial shipment or a firm date before the need date, and copy the superintendent so the crew can be re-sequenced if it slips.`,
          confirmation: `Expedite request sent to the vendor. Superintendent copied.`,
        });
        break;
      }
      case "safety":
        out.push({
          ...base,
          title: `Send overdue corrective-action reminder`,
          summary: a.detail,
          action: `Remind the owner of the overdue corrective action and escalate to the safety lead if it is still open at the next toolbox talk. Evolv routes and reminds only; the supervisor decides what to do on site.`,
          confirmation: `Reminder sent to the action owner. Safety lead copied.`,
        });
        break;
    }
  }

  // History, so the approvals page shows what happens after a decision.
  const first = c.jobs[0];
  out.push({
    id: `${company.id}:${addDays(asOf, -6)}:billing-accelerator:history`,
    companyId: company.id,
    agentId: "billing-accelerator",
    title: `Submit signed tickets to the client's billing system`,
    summary: `Nine signed field tickets on ${first.name} had not been submitted. Total ${moneyCompact(31_400)}.`,
    amount: 31_400,
    evidence: [{ label: "Signed, not submitted", value: "9 tickets", href: "/billing/" }],
    status: "approved",
    proposedAt: localIso(addDays(asOf, -5), 5, 30, 12),
    resolvedAt: localIso(addDays(asOf, -5), 7, 41, 3),
    confirmation: "Nine tickets submitted. Client acknowledged receipt the same afternoon.",
    action: `Submit the nine signed tickets on ${first.name} to the client's billing system with backup attached.`,
  });
  out.push({
    id: `${company.id}:${addDays(asOf, -12)}:labor-analyst:history`,
    companyId: company.id,
    agentId: "labor-analyst",
    title: `Add a Saturday shift on ${c.jobs[c.jobs.length - 1].name}`,
    summary: `Overtime was sitting near 15% and a Saturday shift would have spread the hours. The superintendent judged the crew was fine and declined.`,
    evidence: [{ label: "Overtime share", value: "15%", href: "/labour/" }],
    status: "rejected",
    proposedAt: localIso(addDays(asOf, -11), 5, 10, 8),
    resolvedAt: localIso(addDays(asOf, -11), 8, 12, 40),
    confirmation: "No change made.",
    action: `Add a Saturday shift on ${c.jobs[c.jobs.length - 1].name} to spread the hours.`,
  });
  return out;
}
