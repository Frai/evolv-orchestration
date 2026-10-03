import type { Alert, ChangeOrder, Commitment, Company, CostCode, CostDay, Equipment, FieldTicket, Invoice, Job, SafetyEvent } from "../domain";
import { addDays } from "./dates";
import { jobEvm, trailingCodeCpi, trailingCpi } from "./evm";
import { overtimePct, hoursInRange } from "./labour";
import { billingLag, missingChangeOrders, ticketLeakage } from "./billing";
import { daysOverdue, idleBurn, idleDays, materialSlipDays, materialsAtRisk, overdueSafety, serviceDueInDays } from "./resources";
import { index, int, money, moneyCompact, pct, shortDate } from "./format";

export interface AlertInput {
  company: Company;
  date: string;
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

/** Named rules with explicit thresholds. The contractor's own PM calibrates these during the pilot's shadow mode. */
export const RULES = {
  /** Job-level: forecast margin this far below target raises a warning; twice as far, critical. */
  marginBelowTargetPts: 0.03,
  marginCriticalPts: 0.08,
  /** Skip margin signals until the job has earned enough for a forecast to mean something. */
  minPctComplete: 0.08,
  /** Code-level: sustained CPI below this over the trailing window. */
  codeCpi: 0.9,
  codeMinSpend: 20_000,
  cpiWindowDays: 14,
  overtimeWarnPct: 0.18,
  overtimeCriticalPct: 0.28,
  overtimeMinHours: 200,
  overtimeWindowDays: 7,
  changeOrderCriticalCost: 50_000,
  /** Normal progress-billing cycle: work earned more recently than this is not yet late to invoice. */
  billingGraceDays: 14,
  billingLagPct: 0.1,
  billingLagMin: 100_000,
  billingLagCriticalPct: 0.2,
  ticketCriticalAtRisk: 75_000,
  idleDaysOfSeven: 5,
  serviceDueWithinDays: 7,
  materialCriticalSlipDays: 7,
};

/**
 * Rules over canonical data. Runs at request time so the rules are real even when the data is mocked.
 * Every signal carries a severity, evidence, a suggested action and an owner.
 */
export function detectAlerts(input: AlertInput): Alert[] {
  const { company, date, jobs, codes, costDays, tickets, invoices, changeOrders, equipment, commitments, safety } = input;
  const alerts: Alert[] = [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const push = (a: Omit<Alert, "id" | "companyId" | "date">) =>
    alerts.push({ id: `${company.id}:${date}:${alerts.length + 1}`, companyId: company.id, date, ...a });

  const week = { from: addDays(date, -(RULES.overtimeWindowDays - 1)), to: date };
  const evms = new Map(jobs.map((j) => [j.id, jobEvm(j, codes, costDays, date)]));

  for (const job of jobs) {
    const evm = evms.get(job.id)!;
    const jobCodes = codes.filter((c) => c.jobId === job.id);
    const jobDays = costDays.filter((d) => d.jobId === job.id);

    // Margin erosion
    if (evm.pctComplete >= RULES.minPctComplete) {
      const gap = company.targetMarginPct - evm.marginAtCompletion;
      if (gap >= RULES.marginBelowTargetPts) {
        const trailing = trailingCpi(job, codes, costDays, date, RULES.cpiWindowDays);
        const worst = [...evm.codes].filter((c) => !c.extra || c.ac > 0).sort((a, b) => a.vac - b.vac)[0];
        push({
          severity: gap >= RULES.marginCriticalPts ? "critical" : "warning",
          source: "margin",
          jobId: job.id,
          href: "/jobs/",
          title: `${job.name}: forecast margin ${pct(evm.marginAtCompletion)}, target ${pct(company.targetMarginPct, 0)}`,
          detail: `Trending to ${moneyCompact(evm.eac)} final cost against a ${moneyCompact(evm.bac)} budget. ${worst ? `Biggest driver: ${worst.code} ${worst.name}, ${moneyCompact(Math.abs(worst.vac))} ${worst.vac < 0 ? "over" : "under"}.` : ""}`.trim(),
          suggestedAction: `Review ${worst ? `${worst.code} ${worst.name}` : "the job"} with the superintendent before the month-end close and decide whether to re-plan, re-price or recover the cost.`,
          owner: "Project manager",
          evidence: [
            { label: "CPI to date", value: index(evm.cpi) },
            { label: `CPI, last ${RULES.cpiWindowDays} days`, value: index(trailing) },
            { label: "Estimate at completion", value: money(evm.eac) },
            { label: "Budget at completion", value: money(evm.bac) },
            { label: "Forecast margin", value: `${money(evm.marginDollars)} (${pct(evm.marginAtCompletion)})` },
          ],
        });
      }
    }

    // Code-level budget variance: the early warning, before the job rolls up bad.
    const worstCode = jobCodes
      .filter((c) => !c.extra)
      .map((c) => ({ c, cpi: trailingCodeCpi(c, jobDays, date, RULES.cpiWindowDays), evm: evm.codes.find((e) => e.codeId === c.id)! }))
      .filter((r) => r.cpi !== null && r.cpi < RULES.codeCpi && r.evm.ac >= RULES.codeMinSpend)
      .sort((a, b) => (a.cpi ?? 1) - (b.cpi ?? 1))[0];
    if (worstCode) {
      push({
        severity: "warning",
        source: "margin",
        jobId: job.id,
        href: "/jobs/",
        title: `${job.name}: ${worstCode.c.code} ${worstCode.c.name} running at CPI ${index(worstCode.cpi)}`,
        detail: `Spent ${moneyCompact(worstCode.evm.ac)} to earn ${moneyCompact(worstCode.evm.ev)} of budget. Forecast ${moneyCompact(Math.abs(worstCode.evm.vac))} ${worstCode.evm.vac < 0 ? "over" : "under"} on this code.`,
        suggestedAction: `Ask the foreman what changed on ${worstCode.c.name.toLowerCase()} in the last two weeks: ground conditions, rework or a crew-size problem.`,
        owner: "Superintendent",
        evidence: [
          { label: `CPI, last ${RULES.cpiWindowDays} days`, value: index(worstCode.cpi) },
          { label: "CPI to date", value: index(worstCode.evm.cpi) },
          { label: "Percent complete", value: pct(worstCode.evm.pctComplete, 0) },
          { label: "Forecast variance", value: money(worstCode.evm.vac) },
        ],
      });
    }

    // Overtime
    const { total } = hoursInRange(jobDays, week);
    const ot = overtimePct(jobDays, week);
    if (ot !== null && total >= RULES.overtimeMinHours && ot >= RULES.overtimeWarnPct) {
      push({
        severity: ot >= RULES.overtimeCriticalPct ? "critical" : "warning",
        source: "labour",
        jobId: job.id,
        href: "/labour/",
        title: `${job.name}: overtime at ${pct(ot, 0)} of hours this week`,
        detail: `${int(hoursInRange(jobDays, week).overtime)} of ${int(total)} labour hours were overtime in the last ${RULES.overtimeWindowDays} days. Sustained overtime usually means the crew or the estimate is wrong.`,
        suggestedAction: "Compare crew size to the plan for the codes driving the overtime and propose a reallocation or an added crew.",
        owner: "Superintendent",
        evidence: [
          { label: "Overtime share", value: pct(ot, 0) },
          { label: "Labour hours", value: int(total) },
          { label: "Alert threshold", value: pct(RULES.overtimeWarnPct, 0) },
        ],
      });
    }

    // Billing lag
    const lag = billingLag(job, jobEvm(job, codes, costDays, addDays(date, -RULES.billingGraceDays)), invoices);
    if (lag.lagPct >= RULES.billingLagPct && lag.lag >= RULES.billingLagMin) {
      push({
        severity: lag.lagPct >= RULES.billingLagCriticalPct ? "critical" : "warning",
        source: "billing",
        jobId: job.id,
        href: "/billing/",
        title: `${job.name}: ${moneyCompact(lag.lag)} earned but not yet invoiced`,
        detail: `Work worth ${moneyCompact(lag.earned)} is complete against ${moneyCompact(lag.billed)} invoiced. Work performed well ahead of invoicing predicts a cash-flow squeeze.`,
        suggestedAction: "Assemble the progress billing package from approved quantities and send it to the controller for review.",
        owner: "Controller",
        evidence: [
          { label: "Earned to date", value: money(lag.earned) },
          { label: "Invoiced to date", value: money(lag.billed) },
          { label: "Unbilled", value: `${money(lag.lag)} (${pct(lag.lagPct, 0)})` },
        ],
      });
    }
  }

  // Missing change orders
  for (const m of missingChangeOrders(codes, costDays, changeOrders, date)) {
    const job = jobById.get(m.jobId);
    push({
      severity: m.cost >= RULES.changeOrderCriticalCost ? "critical" : "warning",
      source: "change_orders",
      jobId: m.jobId,
      href: "/billing/",
      title: `${job?.name ?? "Job"}: ${moneyCompact(m.cost)} booked to ${m.code} with no change order`,
      detail: `${int(m.hours)} hours since ${shortDate(m.firstDate)} on ${m.name.toLowerCase()}, outside the original scope. Without a change order this cost comes straight out of margin.`,
      suggestedAction: "Draft the change-order request with the booked hours and cost as backup, then get the superintendent's sign-off before it goes to the client.",
      owner: "Project manager",
      evidence: [
        { label: "Cost booked", value: money(m.cost) },
        { label: "Hours booked", value: int(m.hours) },
        { label: "First booked", value: shortDate(m.firstDate) },
        { label: "Change orders on file", value: "0" },
      ],
    });
  }

  // Field tickets stuck before billing
  const leaks = new Map<string, ReturnType<typeof ticketLeakage>>();
  for (const job of jobs) leaks.set(job.id, ticketLeakage(tickets.filter((t) => t.jobId === job.id), date));
  const leakTotal = [...leaks.values()].reduce((a, l) => a + l.atRisk, 0);
  if (leakTotal > 0) {
    const unsigned = [...leaks.values()].flatMap((l) => l.unsigned);
    const unsubmitted = [...leaks.values()].flatMap((l) => l.unsubmitted);
    const disputed = [...leaks.values()].flatMap((l) => l.disputed);
    const worstJobId = [...leaks.entries()].sort((a, b) => b[1].atRisk - a[1].atRisk)[0][0];
    push({
      severity: leakTotal >= RULES.ticketCriticalAtRisk ? "critical" : "warning",
      source: "tickets",
      jobId: worstJobId,
      href: "/billing/",
      title: `${moneyCompact(leakTotal)} of field tickets stuck before billing`,
      detail: [
        unsigned.length ? `${unsigned.length} unsigned for ${3}+ days` : "",
        unsubmitted.length ? `${unsubmitted.length} signed but not submitted for ${5}+ days` : "",
        disputed.length ? `${disputed.length} disputed` : "",
      ]
        .filter(Boolean)
        .join(", ")
        .concat(". Every day a ticket sits unsigned raises the odds the client disputes it."),
      suggestedAction: "Get the unsigned tickets signed at the next site visit, submit the signed ones to the client's billing system, and attach backup to the disputed ones.",
      owner: "Operations coordinator",
      evidence: [
        { label: "Unsigned", value: money(unsigned.reduce((a, t) => a + t.amount, 0)) },
        { label: "Signed, not submitted", value: money(unsubmitted.reduce((a, t) => a + t.amount, 0)) },
        { label: "Disputed", value: money(disputed.reduce((a, t) => a + t.amount, 0)) },
      ],
    });
  }

  // Equipment
  for (const eq of equipment) {
    const job = jobById.get(eq.jobId);
    const idle = idleDays(eq, 7);
    if (eq.ownership === "rented" && idle >= RULES.idleDaysOfSeven) {
      push({
        severity: "warning",
        source: "equipment",
        jobId: eq.jobId,
        href: "/resources/",
        title: `${eq.name} idle ${idle} of the last 7 days`,
        detail: `Rented at ${money(eq.dailyRate)}/day on ${job?.name ?? "the job"}: ${money(idleBurn(eq, 7))} of rental spent with no work this week.`,
        suggestedAction: "Confirm whether the unit is still needed. If not, schedule the return; if so, move it to a workfront that can use it.",
        owner: "Equipment coordinator",
        evidence: [
          { label: "Idle days (of 7)", value: String(idle) },
          { label: "Daily rate", value: money(eq.dailyRate) },
          { label: "Idle burn this week", value: money(idleBurn(eq, 7)) },
        ],
      });
    }
    const due = serviceDueInDays(eq, date);
    if (due !== null && due >= 0 && due <= RULES.serviceDueWithinDays) {
      push({
        severity: "info",
        source: "equipment",
        jobId: eq.jobId,
        href: "/resources/",
        title: `${eq.name} service due in ${due} day${due === 1 ? "" : "s"}`,
        detail: `Scheduled maintenance lands on ${shortDate(eq.serviceDueDate!)} while the unit is working on ${job?.name ?? "the job"}.`,
        suggestedAction: "Book the shop slot around the look-ahead so the service does not take the unit off a critical workfront.",
        owner: "Equipment coordinator",
        evidence: [
          { label: "Service due", value: shortDate(eq.serviceDueDate!) },
          { label: "Idle days (of 7)", value: String(idle) },
        ],
      });
    }
  }

  // Materials
  for (const c of materialsAtRisk(commitments)) {
    const slip = materialSlipDays(c);
    const job = jobById.get(c.jobId);
    push({
      severity: slip >= RULES.materialCriticalSlipDays ? "critical" : "warning",
      source: "materials",
      jobId: c.jobId,
      href: "/resources/",
      title: `${c.description} lands ${slip} day${slip === 1 ? "" : "s"} after it is needed`,
      detail: `${c.vendor} now promises ${shortDate(c.promisedDate)}; ${job?.name ?? "the job"} needs it ${shortDate(c.needDate)}. The workfront stalls if nothing changes.`,
      suggestedAction: "Press the vendor for a partial shipment, source a substitute, or re-sequence the crew onto other work for the gap.",
      owner: "Procurement",
      evidence: [
        { label: "Promised", value: shortDate(c.promisedDate) },
        { label: "Needed on site", value: shortDate(c.needDate) },
        { label: "Slip", value: `${slip} days` },
        { label: "Order value", value: money(c.committed) },
      ],
    });
  }

  // Safety follow-through: route and remind only; humans decide.
  for (const e of overdueSafety(safety, date)) {
    const job = jobById.get(e.jobId);
    const late = daysOverdue(e, date);
    push({
      severity: e.kind === "incident" ? "critical" : "warning",
      source: "safety",
      jobId: e.jobId,
      href: "/resources/",
      title: `Corrective action overdue ${late} day${late === 1 ? "" : "s"}: ${e.title}`,
      detail: `Raised ${shortDate(e.date)} on ${job?.name ?? "the job"}, due ${shortDate(e.correctiveDue)}. Evolv routes and reminds; the supervisor decides what to do.`,
      suggestedAction: `Remind the ${e.owner.toLowerCase()} and escalate to the safety lead if it is still open at the next toolbox talk.`,
      owner: e.owner,
      evidence: [
        { label: "Type", value: e.kind.replace("_", " ") },
        { label: "Raised", value: shortDate(e.date) },
        { label: "Due", value: shortDate(e.correctiveDue) },
        { label: "Days overdue", value: String(late) },
      ],
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}
