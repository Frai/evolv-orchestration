import type { Alert, Brief, Company, QAPair } from "@evolv/contracts/types";
import type { BriefInput } from "@evolv/contracts/brief";
import { addDays } from "@evolv/contracts/dates";
import { jobEvm, trailingCpi } from "@evolv/contracts/evm";
import { billingLag, missingChangeOrders, ticketLeakage } from "@evolv/contracts/billing";
import { hoursByCode, overtimePct } from "@evolv/contracts/labour";
import { idleBurn, idleDays, materialSlipDays, materialsAtRisk } from "@evolv/contracts/resources";
import type { AlertInput } from "@evolv/contracts/alerts";
import { RULES } from "@evolv/contracts/alerts";
import { index, int, money, moneyCompact, pct, shortDate, signedPts } from "@evolv/contracts/format";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export interface BriefContext {
  company: Company;
  input: BriefInput;
  /** Only for the most recent day: the live ticket picture and decisions waiting. */
  latest?: { alerts: Alert[]; pendingApprovals: number };
  /** Day index in the window, used to rotate wording. */
  variant: number;
}

function headline(c: BriefContext): string {
  const { input: i, company } = c;
  const w = i.worstJob;
  if (w && w.marginAtCompletion < company.targetMarginPct - RULES.marginBelowTargetPts) {
    return `${w.name} is pulling forecast margin to ${pct(i.marginAtCompletion)}, against a ${pct(company.targetMarginPct, 0)} target.`;
  }
  if (i.marginDelta !== null && i.marginDelta <= -0.005) return `Forecast margin slipped to ${pct(i.marginAtCompletion)}, ${signedPts(i.marginDelta)} on the week.`;
  return `Margins are holding: ${pct(i.marginAtCompletion)} forecast against a ${pct(company.targetMarginPct, 0)} target.`;
}

function marginParagraph(c: BriefContext): string {
  const { input: i, company, variant } = c;
  const move =
    i.marginDelta === null
      ? ""
      : Math.abs(i.marginDelta) < 0.002
        ? ` That is flat against last ${i.weekdayName}.`
        : ` That is ${signedPts(i.marginDelta)} against last ${i.weekdayName}.`;
  const lead =
    variant % 2 === 0
      ? `Across ${plural(i.jobs.length, "active job")} you are forecasting ${pct(i.marginAtCompletion)} margin at completion, ${moneyCompact(i.marginDollars)}, against a ${pct(company.targetMarginPct, 0)} target.`
      : `Portfolio forecast margin is ${pct(i.marginAtCompletion)} (${moneyCompact(i.marginDollars)}) on ${plural(i.jobs.length, "active job")}; you bid to ${pct(company.targetMarginPct, 0)}.`;
  return lead + move;
}

function jobParagraph(c: BriefContext): string {
  const w = c.input.worstJob;
  if (!w) return "";
  const trailing = w.trailingCpi;
  const bad = trailing !== null && trailing < 0.95;
  if (bad) {
    return `${w.name} is the weak spot: forecast margin ${pct(w.marginAtCompletion)}, CPI ${index(w.cpi)} to date and ${index(trailing)} over the last two weeks, ${pct(w.pctComplete, 0)} complete. Spend is running ahead of work installed, and the recent trend is worse than the average.`;
  }
  return `The lowest-margin job is ${w.name} at ${pct(w.marginAtCompletion)} forecast, ${pct(w.pctComplete, 0)} complete. Cost performance is steady (CPI ${index(w.cpi)} to date, ${index(trailing)} over the last two weeks), so nothing is trending the wrong way.`;
}

function cashParagraph(c: BriefContext): string | null {
  const { input: i } = c;
  const bits: string[] = [];
  if (i.unbilledWork >= RULES.billingLagMin) bits.push(`${moneyCompact(i.unbilledWork)} of earned work is past the billing cycle and not invoiced`);
  if (i.missingChangeOrderCost > 0) bits.push(`${moneyCompact(i.missingChangeOrderCost)} is booked to extra-work codes with no change order`);
  if (i.ticketsAtRisk > 0) bits.push(`${moneyCompact(i.ticketsAtRisk)} of field tickets are stuck before billing`);
  if (!bits.length) return null;
  const [first, ...rest] = bits;
  return `On cash: ${first}${rest.length ? `; ${rest.join("; ")}` : ""}. Each of these is revenue that exists in the field but not yet in an invoice.`;
}

function labourParagraph(c: BriefContext): string | null {
  const { input: i } = c;
  if (i.overtimePct === null) return null;
  const prev = i.overtimePctPrev !== null ? ` against ${pct(i.overtimePctPrev, 0)} the week before` : "";
  const tail = i.overtimePct >= RULES.overtimeWarnPct ? " Sustained overtime at this level usually means the crew size or the estimate is wrong." : "";
  return `Overtime ran ${pct(i.overtimePct, 0)} of labour hours over the last seven days${prev}.${tail}`;
}

export function composeBrief(c: BriefContext, channel: Brief["channel"], deliveredAt: string): Brief {
  const paragraphs = [marginParagraph(c), jobParagraph(c), cashParagraph(c), labourParagraph(c)].filter((p): p is string => !!p);
  if (c.latest) {
    const top = c.latest.alerts.filter((a) => a.severity !== "info").slice(0, 3);
    const pending = c.latest.pendingApprovals;
    if (top.length || pending) {
      paragraphs.push(
        `For you today: ${pending ? `${plural(pending, "approval")} waiting${top.length ? ", and " : "."}` : ""}${top.length ? `the signals that matter most are ${top.map((a) => a.title.replace(/\.$/, "")).join("; ")}.` : ""}`,
      );
    }
  }
  return { companyId: c.input.companyId, date: c.input.date, headline: headline(c), paragraphs, deliveredAt, channel };
}

// ---------------------------------------------------------------------------
// Q&A: pre-written answers over today's numbers
// ---------------------------------------------------------------------------

export function generateQA(input: AlertInput): QAPair[] {
  const { company, date, jobs, codes, costDays, tickets, invoices, changeOrders, equipment, commitments } = input;
  const jobName = new Map(jobs.map((j) => [j.id, j.name]));
  const evms = jobs.map((j) => jobEvm(j, codes, costDays, date));
  const out: QAPair[] = [];
  const add = (question: string, keywords: string[], answer: string) => out.push({ companyId: company.id, question, keywords, answer });

  // 1. Margin risk
  const below = jobs
    .map((j, i) => ({ j, e: evms[i] }))
    .filter((r) => r.e.marginAtCompletion < company.targetMarginPct)
    .sort((a, b) => a.e.marginAtCompletion - b.e.marginAtCompletion);
  add(
    "Which jobs are at margin risk?",
    ["margin", "risk", "jobs", "trending", "profit", "profitable", "eroding", "erosion"],
    below.length
      ? `${plural(below.length, "job")} below your ${pct(company.targetMarginPct, 0)} target: ${below.map((r) => `${r.j.name} at ${pct(r.e.marginAtCompletion)} (CPI ${index(r.e.cpi)})`).join("; ")}. The rest are at or above target.`
      : `Every active job is forecasting at or above your ${pct(company.targetMarginPct, 0)} target. The lowest is ${jobs.length ? "within a point or two of it" : "n/a"}; nothing is eroding.`,
  );

  // 2. Why is the worst job over budget
  const worst = jobs.map((j, i) => ({ j, e: evms[i] })).sort((a, b) => a.e.marginAtCompletion - b.e.marginAtCompletion)[0];
  if (worst) {
    const drivers = worst.e.codes.filter((c) => c.vac < 0).sort((a, b) => a.vac - b.vac).slice(0, 3);
    const t = trailingCpi(worst.j, codes, costDays, date);
    add(
      `Why is ${worst.j.name} over budget?`,
      ["why", "over", "budget", "overrun", "overspend", "cost", "driver", "drivers", ...worst.j.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3)],
      drivers.length
        ? `${worst.j.name} forecasts ${moneyCompact(worst.e.eac)} against a ${moneyCompact(worst.e.bac)} budget. The biggest drivers: ${drivers.map((d) => `${d.code} ${d.name} (${moneyCompact(Math.abs(d.vac))} over, CPI ${index(d.cpi)})`).join("; ")}. CPI over the last two weeks is ${index(t)}.`
        : `${worst.j.name} is not over budget on any cost code. It forecasts ${moneyCompact(worst.e.eac)} against ${moneyCompact(worst.e.bac)}.`,
    );
  }

  // 3. Unbilled work
  const lags = jobs.map((j) => ({ j, lag: billingLag(j, jobEvm(j, codes, costDays, addDays(date, -RULES.billingGraceDays)), invoices) })).filter((r) => r.lag.lag > 0).sort((a, b) => b.lag.lag - a.lag.lag);
  const lagTotal = lags.reduce((a, r) => a + r.lag.lag, 0);
  add(
    "How much work is done but not billed?",
    ["billed", "unbilled", "billing", "invoice", "invoiced", "invoices", "bill", "done"],
    lags.length
      ? `${money(lagTotal)} is earned but not yet invoiced, counting only work older than your ${RULES.billingGraceDays}-day billing cycle. Largest: ${lags.slice(0, 3).map((r) => `${r.j.name} ${moneyCompact(r.lag.lag)} (${pct(r.lag.lagPct, 0)} of earned)`).join("; ")}.`
      : `Nothing material. Every job is invoiced up to within your normal ${RULES.billingGraceDays}-day billing cycle.`,
  );

  // 4. Overtime
  const week = { from: addDays(date, -6), to: date };
  const ot = jobs.map((j) => ({ j, pct: overtimePct(costDays.filter((d) => d.jobId === j.id), week) })).filter((r) => r.pct !== null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const topOt = ot[0];
  if (topOt && topOt.pct !== null) {
    const codeNames = new Map(codes.map((c) => [c.id, `${c.code} ${c.name}`]));
    const byCode = hoursByCode(costDays.filter((d) => d.jobId === topOt.j.id), week).slice(0, 2);
    add(
      "Where is overtime coming from?",
      ["overtime", "hours", "crew", "labour", "labor", "ot"],
      `${topOt.j.name} has the most: ${pct(topOt.pct, 0)} of labour hours over the last seven days${topOt.pct >= RULES.overtimeWarnPct ? ", above your alert line" : ""}. By cost code: ${byCode.map((b) => `${codeNames.get(b.codeId)} (${pct(b.overtimePct, 0)} overtime on ${int(b.hours)} h)`).join("; ")}. Other jobs: ${ot.slice(1).map((r) => `${r.j.name} ${pct(r.pct ?? 0, 0)}`).join(", ") || "none"}.`,
    );
  }

  // 5. Change orders
  const missing = missingChangeOrders(codes, costDays, changeOrders, date);
  add(
    "Are any change orders missing?",
    ["change", "orders", "order", "extra", "missing", "unapproved", "scope", "t&m"],
    missing.length
      ? `Yes. ${missing.map((m) => `${jobName.get(m.jobId)}: ${moneyCompact(m.cost)} (${int(m.hours)} h) booked to ${m.code} ${m.name} since ${shortDate(m.firstDate)} with no change order on file`).join("; ")}. That cost comes out of margin unless it is documented and billed.`
      : "No. Every extra-work cost code has a change order on file.",
  );

  // 6. Tickets
  const leaks = ticketLeakage(tickets, date);
  add(
    "Which field tickets are stuck?",
    ["ticket", "tickets", "stuck", "signed", "unsigned", "dispute", "disputed", "submitted", "field"],
    leaks.atRisk > 0
      ? `${money(leaks.atRisk)} across ${leaks.unsigned.length + leaks.unsubmitted.length + leaks.disputed.length} tickets: ${leaks.unsigned.length} unsigned for ${3}+ days, ${leaks.unsubmitted.length} signed but not submitted for ${5}+ days, ${leaks.disputed.length} disputed. Unsigned tickets are the most urgent; the client forgets the work fast.`
      : "None. Every ticket past the sign-off window has been signed and submitted.",
  );

  // 7. Materials
  const late = materialsAtRisk(commitments);
  add(
    "Is any material going to be late?",
    ["material", "materials", "pipe", "late", "delivery", "delay", "po", "vendor", "supply"],
    late.length
      ? late.map((c) => `${c.description} from ${c.vendor} is promised ${shortDate(c.promisedDate)}, needed ${shortDate(c.needDate)}: ${materialSlipDays(c)} days late on ${jobName.get(c.jobId)}`).join("; ") + "."
      : "No. Every open commitment is promised on or before the date the schedule needs it.",
  );

  // 8. Equipment
  const idle = equipment.filter((e) => e.ownership === "rented" && idleDays(e, 7) >= 3);
  add(
    "What is idle equipment costing us?",
    ["equipment", "idle", "rental", "rented", "utilization", "iron", "truck", "excavator"],
    idle.length
      ? `${idle.map((e) => `${e.name} idle ${idleDays(e, 7)} of 7 days, ${money(idleBurn(e, 7))} of rental this week on ${jobName.get(e.jobId)}`).join("; ")}. Return it or move it to a workfront that needs it.`
      : "Nothing material. No rented unit has sat idle for more than two days this week.",
  );
  return out;
}
