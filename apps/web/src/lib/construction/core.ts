/**
 * Pure rules over the mock world: job financials, portfolio roll-up, alerts, the morning brief,
 * canned Q&A, agent runs and approvals. The data is fake; the arithmetic is real.
 */
import type { Agent, AgentRun, Alert, Approval, Brief, ChangeOrder, Company, Milestone, ProcurementItem, Project, ProjectHealth, QAPair, RunStep, Subcontractor } from "./types";
import { COMPANIES, TODAY, WORLD, attachMarginHistory, originalMarginOf } from "./fixtures";
import { addDays, daysBetween, lcFirst, money, moneyShort, pct, possessive, pts, shortDate } from "./format";

export const HOLDBACK_RATE = 0.1;
export const DEFAULT_CO_AGING_DAYS = 21;

const PENDING = new Set(["unpriced", "pricing", "submitted"]);
const APPROVED = new Set(["approved", "billed"]);

/** Converts a local wall-clock time on `date` in `tz` to a UTC ISO string. */
export function localIso(date: string, hhmm: string, tz: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const guess = new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  return new Date(guess.getTime() - (asLocal - guess.getTime())).toISOString();
}

// ---------- job financials ----------
export interface ProjectFinancials {
  project: Project;
  originalMargin: number;
  revisedContract: number;
  revisedBudget: number;
  committed: number;
  actual: number;
  /** Forecast cost at completion, including the cost of change work crews have already started. */
  fac: number;
  forecastMargin: number;
  marginDelta: number;
  /** Margin if every field-started pending change is approved at its estimated value. */
  recoverableMargin: number;
  earnedRevenue: number;
  /** Positive = overbilled, negative = underbilled. */
  overUnderBilled: number;
  holdbackReceivable: number;
  exposure: { count: number; cost: number; value: number; oldestDays: number; oldest?: ChangeOrder; items: ChangeOrder[] };
  pendingNotStarted: { count: number; value: number };
  slipDays: number;
  health: ProjectHealth;
  /** Margin change over the last four weekly snapshots. */
  margin4w: number;
}

function changeOrdersFor(projectId: string) {
  return WORLD.changeOrders.filter((c) => c.projectId === projectId);
}

const finCache = new Map<string, ProjectFinancials>();

export function projectFinancials(p: Project): ProjectFinancials {
  const hit = finCache.get(p.id);
  if (hit) return hit;
  const cos = changeOrdersFor(p.id);
  const approved = cos.filter((c) => APPROVED.has(c.status));
  const approvedValue = approved.reduce((s, c) => s + c.value, 0);
  const approvedCost = approved.reduce((s, c) => s + c.cost, 0);
  const started = cos.filter((c) => PENDING.has(c.status) && c.fieldStarted).sort((a, b) => a.raisedOn.localeCompare(b.raisedOn));
  const notStarted = cos.filter((c) => PENDING.has(c.status) && !c.fieldStarted);
  const exposureCost = started.reduce((s, c) => s + c.cost, 0);
  const exposureValue = started.reduce((s, c) => s + c.value, 0);

  const revisedContract = p.contractValue + approvedValue;
  const revisedBudget = p.originalBudget + approvedCost;
  const codeForecast = p.costCodes.reduce((s, c) => s + c.forecast, 0);
  const fac = codeForecast + approvedCost + exposureCost;
  const forecastMargin = (revisedContract - fac) / revisedContract;
  const recoverableMargin = (revisedContract + exposureValue - fac) / (revisedContract + exposureValue);
  const originalMargin = originalMarginOf(p.id);
  const earnedRevenue = Math.round(revisedContract * p.pctComplete);
  const slipDays = daysBetween(p.baselineCompletion, p.forecastCompletion);
  attachMarginHistory(p, forecastMargin);
  const h = p.marginHistory;
  const margin4w = h[h.length - 1].margin - h[h.length - 5].margin;
  const marginDelta = forecastMargin - originalMargin;

  let health: ProjectHealth = "on_track";
  if (marginDelta <= -0.02 || slipDays >= 21) health = "at_risk";
  else if (marginDelta <= -0.006 || slipDays >= 7) health = "watch";

  const f: ProjectFinancials = {
    project: p,
    originalMargin,
    revisedContract,
    revisedBudget,
    committed: p.costCodes.reduce((s, c) => s + c.committed, 0) + approvedCost,
    actual: p.costCodes.reduce((s, c) => s + c.actual, 0) + Math.round(exposureCost * 0.6),
    fac,
    forecastMargin,
    marginDelta,
    recoverableMargin,
    earnedRevenue,
    overUnderBilled: p.billedToDate - earnedRevenue,
    holdbackReceivable: Math.round(p.billedToDate * HOLDBACK_RATE),
    exposure: { count: started.length, cost: exposureCost, value: exposureValue, oldestDays: started[0] ? daysBetween(started[0].raisedOn, TODAY) : 0, oldest: started[0], items: started },
    pendingNotStarted: { count: notStarted.length, value: notStarted.reduce((s, c) => s + c.value, 0) },
    slipDays,
    health,
    margin4w,
  };
  finCache.set(p.id, f);
  return f;
}

// ---------- accessors ----------
export function companyById(id: string): Company {
  return COMPANIES.find((c) => c.id === id)!;
}
export function projectsFor(companyId: string): Project[] {
  return WORLD.projects.filter((p) => p.companyId === companyId);
}
export function projectById(id: string): Project | undefined {
  return WORLD.projects.find((p) => p.id === id);
}
export function changeOrdersForCompany(companyId: string): ChangeOrder[] {
  const ids = new Set(projectsFor(companyId).map((p) => p.id));
  return WORLD.changeOrders.filter((c) => ids.has(c.projectId));
}
export function milestonesForCompany(companyId: string): Milestone[] {
  const ids = new Set(projectsFor(companyId).map((p) => p.id));
  return WORLD.milestones.filter((m) => ids.has(m.projectId));
}
export function procurementForCompany(companyId: string): ProcurementItem[] {
  const ids = new Set(projectsFor(companyId).map((p) => p.id));
  return WORLD.procurement.filter((m) => ids.has(m.projectId));
}
export function subsForCompany(companyId: string): Subcontractor[] {
  return WORLD.subs.filter((s) => s.companyId === companyId);
}
export function coAgeDays(c: ChangeOrder): number {
  return daysBetween(c.raisedOn, TODAY);
}
export function procurementLateDays(i: ProcurementItem): number {
  return daysBetween(i.needBy, i.expectedDelivery);
}

// ---------- portfolio ----------
export interface Portfolio {
  company: Company;
  jobs: ProjectFinancials[];
  revisedContract: number;
  backlog: number;
  forecastMargin: number;
  originalMargin: number;
  margin4w: number;
  exposure: { count: number; cost: number; value: number; jobs: number };
  atRisk: number;
  watch: number;
  overUnderBilled: number;
  underBilled: number;
  holdbackReceivable: number;
  holdbackPayable: number;
  payAppsPending: { count: number; amount: number };
  complianceIssues: number;
  lateProcurement: number;
}

export function subCompliance(s: Subcontractor) {
  const wcbDays = daysBetween(TODAY, s.wcbExpiry);
  const insDays = daysBetween(TODAY, s.insuranceExpiry);
  const wcbExpired = wcbDays < 0;
  const insExpired = insDays < 0;
  const insSoon = !insExpired && insDays <= 30;
  const wcbSoon = !wcbExpired && wcbDays <= 30;
  const lienMissing = s.lienWaiver === "missing";
  const blocked = wcbExpired || insExpired;
  return { wcbDays, insDays, wcbExpired, insExpired, insSoon, wcbSoon, lienMissing, blocked, ok: !blocked && !insSoon && !wcbSoon && !lienMissing };
}

export function portfolio(companyId: string): Portfolio {
  const company = companyById(companyId);
  const jobs = projectsFor(companyId).map(projectFinancials);
  const revisedContract = jobs.reduce((s, j) => s + j.revisedContract, 0);
  const fac = jobs.reduce((s, j) => s + j.fac, 0);
  const original = jobs.reduce((s, j) => s + j.project.contractValue * j.originalMargin, 0) / jobs.reduce((s, j) => s + j.project.contractValue, 0);
  const subs = subsForCompany(companyId);
  const forecastMargin = (revisedContract - fac) / revisedContract;
  // Four weeks ago, weighted the same way.
  const then = jobs.reduce((s, j) => s + j.revisedContract * j.project.marginHistory[j.project.marginHistory.length - 5].margin, 0) / revisedContract;
  return {
    company,
    jobs,
    revisedContract,
    backlog: jobs.reduce((s, j) => s + j.revisedContract * (1 - j.project.pctComplete), 0),
    forecastMargin,
    originalMargin: original,
    margin4w: forecastMargin - then,
    exposure: {
      count: jobs.reduce((s, j) => s + j.exposure.count, 0),
      cost: jobs.reduce((s, j) => s + j.exposure.cost, 0),
      value: jobs.reduce((s, j) => s + j.exposure.value, 0),
      jobs: jobs.filter((j) => j.exposure.count > 0).length,
    },
    atRisk: jobs.filter((j) => j.health === "at_risk").length,
    watch: jobs.filter((j) => j.health === "watch").length,
    overUnderBilled: jobs.reduce((s, j) => s + j.overUnderBilled, 0),
    underBilled: jobs.reduce((s, j) => s + Math.min(0, j.overUnderBilled), 0),
    holdbackReceivable: jobs.reduce((s, j) => s + j.holdbackReceivable, 0),
    holdbackPayable: Math.round(subs.reduce((s, x) => s + x.billedToDate, 0) * HOLDBACK_RATE),
    payAppsPending: {
      count: subs.filter((s) => s.payApp.status === "received" || s.payApp.status === "under_review").length,
      amount: subs.filter((s) => s.payApp.status === "received" || s.payApp.status === "under_review").reduce((a, s) => a + s.payApp.amount, 0),
    },
    complianceIssues: subs.filter((s) => !subCompliance(s).ok).length,
    lateProcurement: procurementForCompany(companyId).filter((i) => procurementLateDays(i) > 0 && i.status !== "delivered").length,
  };
}

// ---------- alerts ----------
const SEV_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export function detectAlerts(companyId: string, coAgingDays = DEFAULT_CO_AGING_DAYS): Alert[] {
  const pf = portfolio(companyId);
  const company = pf.company;
  const out: Alert[] = [];

  for (const j of pf.jobs) {
    const p = j.project;
    if (j.exposure.count && j.exposure.oldestDays >= coAgingDays) {
      const big = j.exposure.value >= p.contractValue * 0.015 || j.exposure.oldestDays >= 30;
      out.push({
        id: `exposure-${p.id}`,
        severity: big ? "critical" : "warning",
        title: `${p.name}: ${moneyShort(j.exposure.value)} of change work started, not priced`,
        detail: `${j.exposure.count} item${j.exposure.count === 1 ? "" : "s"}, oldest ${j.exposure.oldestDays} days (${j.exposure.oldest!.number}). Forecast margin ${pct(j.originalMargin)} → ${pct(j.forecastMargin)}.`,
        href: `/change-orders/?project=${p.id}`,
      });
    } else if (j.margin4w <= -0.012) {
      out.push({
        id: `fade-${p.id}`,
        severity: "warning",
        title: `${p.name}: margin down ${pts(j.margin4w)} in four weeks`,
        detail: `Now ${pct(j.forecastMargin)} against ${pct(j.originalMargin)} at award. Biggest driver: ${worstCode(p).name.toLowerCase()}.`,
        href: `/projects/?id=${p.id}`,
      });
    }
    if (j.overUnderBilled < -Math.max(60_000, p.contractValue * 0.03)) {
      out.push({
        id: `underbilled-${p.id}`,
        severity: "warning",
        title: `${p.name}: underbilled ${moneyShort(-j.overUnderBilled)}`,
        detail: `Work in place is ahead of billing. Earned ${moneyShort(j.earnedRevenue)}, billed ${moneyShort(p.billedToDate)}. Catch it up on this month's progress claim.`,
        href: `/payments/`,
      });
    }
  }

  for (const i of procurementForCompany(companyId)) {
    const late = procurementLateDays(i);
    if (late <= 0) continue;
    const p = projectById(i.projectId)!;
    out.push({
      id: `proc-${i.id}`,
      severity: late >= 14 ? "critical" : "warning",
      title: `${i.item} lands ${late} days after need-by`,
      detail: `${p.name}. ${i.supplier}, ${i.leadWeeks}-week lead. Needed ${shortDate(i.needBy)}, expected ${shortDate(i.expectedDelivery)}.`,
      href: `/schedule/`,
    });
  }

  for (const s of subsForCompany(companyId)) {
    const c = subCompliance(s);
    if (c.wcbExpired) {
      out.push({
        id: `wcb-${s.id}`,
        severity: "critical",
        title: `${s.name}: ${company.wcbName} clearance expired ${-c.wcbDays} day${c.wcbDays === -1 ? "" : "s"} ago`,
        detail: s.payApp.amount ? `${money(s.payApp.amount)} pay application is on hold until a new clearance letter is on file.` : "No payments can be released until a new clearance letter is on file.",
        href: `/payments/`,
      });
    } else if (c.insSoon) {
      out.push({
        id: `ins-${s.id}`,
        severity: "warning",
        title: `${s.name}: insurance certificate expires in ${c.insDays} days`,
        detail: `Request a renewed certificate of insurance before ${shortDate(s.insuranceExpiry)}.`,
        href: `/payments/`,
      });
    }
    if (c.lienMissing && s.payApp.amount && s.payApp.status !== "paid") {
      out.push({
        id: `lien-${s.id}`,
        severity: "warning",
        title: `${s.name}: no lien waiver for last payment`,
        detail: `Hold the ${money(s.payApp.amount)} pay application until the statutory declaration is received.`,
        href: `/payments/`,
      });
    }
  }

  return out.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
}

export function worstCode(p: Project) {
  return [...p.costCodes].sort((a, b) => b.forecast - b.budget - (a.forecast - a.budget))[0];
}

// ---------- brief ----------
function hero(pf: Portfolio): ProjectFinancials | undefined {
  return [...pf.jobs].sort((a, b) => b.exposure.value - a.exposure.value)[0];
}

export function buildBrief(companyId: string): Brief {
  const pf = portfolio(companyId);
  const c = pf.company;
  const h = hero(pf);
  const alerts = detectAlerts(companyId);
  const paras: string[] = [];

  const marginLine =
    pf.forecastMargin < c.targetMarginPct
      ? `Across ${pf.jobs.length} active jobs, forecast margin is ${pct(pf.forecastMargin)}, under your ${pct(c.targetMarginPct)} target`
      : `Across ${pf.jobs.length} active jobs, forecast margin is ${pct(pf.forecastMargin)}, above your ${pct(c.targetMarginPct)} target`;
  paras.push(
    `${marginLine}${Math.abs(pf.margin4w) >= 0.001 ? ` and ${pf.margin4w < 0 ? "down" : "up"} ${pts(pf.margin4w)} in four weeks` : ""}. Backlog is ${moneyShort(pf.backlog)} on ${moneyShort(pf.revisedContract)} of contracts. ${pf.atRisk ? `${pf.atRisk} job${pf.atRisk === 1 ? " is" : "s are"} at risk${pf.watch ? `, ${pf.watch} on watch` : ""}.` : pf.watch ? `${pf.watch} job${pf.watch === 1 ? " is" : "s are"} on watch, none at risk.` : "Every job is on track."}`,
  );

  if (h && h.exposure.count) {
    const p = h.project;
    const o = h.exposure.oldest!;
    paras.push(
      `${p.name} is where the money is going. Crews have started ${h.exposure.count} piece${h.exposure.count === 1 ? "" : "s"} of change work worth about ${moneyShort(h.exposure.value)} to the owner, and none of it is priced and approved yet. The oldest, ${o.number} (${lcFirst(o.title)}), is ${h.exposure.oldestDays} days old. The cost is already landing in job cost and the revenue isn't, so forecast margin has slid from ${pct(h.originalMargin)} to ${pct(h.forecastMargin)}. Priced and approved at estimate, it comes back to ${pct(h.recoverableMargin)}.`,
    );
  }

  const proc = procurementForCompany(companyId)
    .filter((i) => procurementLateDays(i) > 0)
    .sort((a, b) => procurementLateDays(b) - procurementLateDays(a))[0];
  if (proc) {
    const p = projectById(proc.projectId)!;
    const f = projectFinancials(p);
    paras.push(
      `On schedule, watch the ${lcFirst(proc.item)} for ${p.name}. ${proc.supplier} is showing ${shortDate(proc.expectedDelivery)}, ${procurementLateDays(proc)} days after it's needed${f.slipDays ? `, and substantial completion is already forecast ${f.slipDays} days past baseline` : ""}.`,
    );
  }

  const blocked = subsForCompany(companyId).filter((s) => subCompliance(s).blocked);
  const cash: string[] = [];
  if (pf.underBilled < -50_000) cash.push(`you're underbilled ${moneyShort(-pf.underBilled)} across the portfolio, so this month's claims should catch that up`);
  if (pf.payAppsPending.count) cash.push(`${pf.payAppsPending.count} sub pay application${pf.payAppsPending.count === 1 ? "" : "s"} worth ${moneyShort(pf.payAppsPending.amount)} are waiting on review`);
  if (blocked.length) cash.push(`${blocked.map((s) => s.name).join(" and ")} can't be paid until ${c.wcbName} clearance is renewed`);
  if (cash.length) paras.push(`On cash, ${cash.join("; ")}. Holdback owed to you stands at ${moneyShort(pf.holdbackReceivable)}.`);

  const top = alerts[0];
  const headline = h && h.exposure.count && h.exposure.value > 100_000
    ? `${moneyShort(h.exposure.value)} of unpriced change work is eating the margin on ${h.project.name.split(",")[0]}`
    : top
      ? top.title
      : "Every job inside its numbers";

  return { companyId, date: TODAY, deliveredAt: localIso(TODAY, "06:00", c.timeZone), headline, paragraphs: paras };
}

// ---------- Q&A ----------
export function suggestedQuestions(): string[] {
  return ["Which job is losing the most margin?", "How much change work is unpriced?", "What could push a completion date?", "Are we over or under billed?", "Which subs can't be paid?"];
}

export function qaPairs(companyId: string): QAPair[] {
  const pf = portfolio(companyId);
  const c = pf.company;
  const byFade = [...pf.jobs].sort((a, b) => a.marginDelta - b.marginDelta);
  const w = byFade[0];
  const wc = worstCode(w.project);
  const exposureJobs = pf.jobs.filter((j) => j.exposure.count).sort((a, b) => b.exposure.value - a.exposure.value);
  const late = procurementForCompany(companyId).filter((i) => procurementLateDays(i) > 0).sort((a, b) => procurementLateDays(b) - procurementLateDays(a));
  const slipping = pf.jobs.filter((j) => j.slipDays > 0).sort((a, b) => b.slipDays - a.slipDays);
  const under = pf.jobs.filter((j) => j.overUnderBilled < 0).sort((a, b) => a.overUnderBilled - b.overUnderBilled);
  const over = pf.jobs.filter((j) => j.overUnderBilled > 0).sort((a, b) => b.overUnderBilled - a.overUnderBilled);
  const subs = subsForCompany(companyId);
  const blocked = subs.filter((s) => subCompliance(s).blocked || subCompliance(s).lienMissing);

  return [
    {
      question: "Which job is losing the most margin?",
      keywords: ["margin", "losing", "fade", "worst", "profit"],
      answer: `${w.project.name}. It was bid at ${pct(w.originalMargin)} and is forecasting ${pct(w.forecastMargin)} today, a drop of ${pts(w.marginDelta)}${w.exposure.count ? `, mostly from ${w.exposure.count} field-started changes that aren't priced (${moneyShort(w.exposure.cost)} of cost with no revenue against it)` : ""}. The worst cost code is ${wc.code} ${wc.name.toLowerCase()}, forecasting ${moneyShort(wc.forecast - wc.budget)} over budget.`,
    },
    {
      question: "How much change work is unpriced?",
      keywords: ["change", "unpriced", "co", "pco", "extra", "price"],
      answer: exposureJobs.length
        ? `${pf.exposure.count} items on ${pf.exposure.jobs} job${pf.exposure.jobs === 1 ? "" : "s"}, worth about ${moneyShort(pf.exposure.value)} to owners, where crews have already started the work. ${exposureJobs.map((j) => `${j.project.name}: ${moneyShort(j.exposure.value)} across ${j.exposure.count}, oldest ${j.exposure.oldestDays} days`).join(". ")}.`
        : "None. Every change your crews have started has been priced and submitted.",
    },
    {
      question: "What could push a completion date?",
      keywords: ["schedule", "late", "completion", "delay", "slip", "lead", "procurement"],
      answer: late.length
        ? `${late
            .slice(0, 2)
            .map((i) => `${i.item} for ${projectById(i.projectId)!.name} lands ${procurementLateDays(i)} days after need-by (${i.supplier})`)
            .join(". ")}.${slipping[0] ? ` ${slipping[0].project.name} is already forecasting substantial completion ${slipping[0].slipDays} days past baseline.` : ""}`
        : "Nothing on the long-lead list is landing after its need-by date.",
    },
    {
      question: "Are we over or under billed?",
      keywords: ["billed", "billing", "wip", "overbilled", "underbilled", "cash", "invoice"],
      answer: `Net ${pf.overUnderBilled >= 0 ? "overbilled" : "underbilled"} ${moneyShort(Math.abs(pf.overUnderBilled))} across the portfolio.${under[0] ? ` Most underbilled: ${under[0].project.name} at ${moneyShort(-under[0].overUnderBilled)}.` : ""}${over[0] ? ` Most overbilled: ${over[0].project.name} at ${moneyShort(over[0].overUnderBilled)}.` : ""} Holdback owed to you is ${moneyShort(pf.holdbackReceivable)}.`,
    },
    {
      question: "Which subs can't be paid?",
      keywords: ["sub", "subs", "pay", "wcb", "wsib", "worksafe", "insurance", "lien", "compliance"],
      answer: blocked.length
        ? blocked
            .map((s) => {
              const k = subCompliance(s);
              const why = k.wcbExpired ? `${c.wcbName} clearance expired ${-k.wcbDays} days ago` : k.insExpired ? "insurance expired" : "lien waiver missing for the last payment";
              return `${s.name} (${s.trade.toLowerCase()}): ${why}${s.payApp.amount ? `, ${money(s.payApp.amount)} on hold` : ""}`;
            })
            .join(". ") + "."
        : "None. Every sub with a pay application in has current clearance, insurance and lien waivers.",
    },
  ];
}

export function answer(companyId: string, question: string): string {
  const q = question.toLowerCase();
  const pairs = qaPairs(companyId);
  const exact = pairs.find((p) => p.question.toLowerCase() === q.trim());
  if (exact) return exact.answer;
  let best: { score: number; a?: string } = { score: 0 };
  for (const p of pairs) {
    const score = p.keywords.filter((k) => q.includes(k)).length;
    if (score > best.score) best = { score, a: p.answer };
  }
  return best.a ?? "I can answer questions about margin, change orders, schedule, billing and subcontractors in this demo. Try one of the suggestions below.";
}

// ---------- agents ----------
export const AGENTS: Agent[] = [
  { id: "co-chaser", name: "Change Order Chaser", short: "COs", description: "Finds field work that has started without a priced change order, builds the pricing package from cost codes and RFIs, and drafts it to the owner.", schedule: "Nightly at 5:00 AM", status: "active", defaultMode: "ask_first" },
  { id: "cost-forecaster", name: "Cost Forecaster", short: "Cost", description: "Re-forecasts cost at completion for every job from commitments, actuals and open changes, and flags margin fade.", schedule: "Nightly at 5:10 AM", status: "active", defaultMode: "auto" },
  { id: "procurement-watch", name: "Procurement Watch", short: "Procure", description: "Tracks long-lead items against need-by dates and the schedule, and drafts expedite requests to suppliers.", schedule: "Nightly at 5:15 AM", status: "active", defaultMode: "ask_first" },
  { id: "sub-compliance", name: "Sub Compliance", short: "Subs", description: "Checks workers' comp clearance, insurance and lien waivers before any sub payment goes out.", schedule: "Nightly at 5:20 AM", status: "active", defaultMode: "ask_first" },
  { id: "billing-assistant", name: "Billing Assistant", short: "Billing", description: "Compares work in place to billing and drafts the monthly progress claim so nothing is left on the table.", schedule: "Nightly at 5:25 AM", status: "active", defaultMode: "ask_first" },
  { id: "morning-brief", name: "Morning Brief", short: "Brief", description: "Writes the morning brief from the other agents' findings and sends it to you.", schedule: "Daily at 5:45 AM", status: "active", defaultMode: "auto" },
  { id: "daily-log-reader", name: "Daily Log Reader", short: "Logs", description: "Reads superintendents' daily logs for extra work, delays and weather that should become a change or a notice.", schedule: "Coming soon", status: "coming_soon", defaultMode: "ask_first" },
];

function step(index: number, title: string, tool: string, inputSummary: string, outputSummary: string, durationMs: number): RunStep {
  return { index, title, tool, inputSummary, outputSummary, durationMs, status: "ok" };
}

function mkRun(c: Company, agentId: string, date: string, hhmm: string, goal: string, steps: RunStep[], outcome: AgentRun["outcome"], status: AgentRun["status"]): AgentRun {
  const startedAt = localIso(date, hhmm, c.timeZone);
  const durationMs = steps.reduce((s, x) => s + x.durationMs, 0);
  return { id: `${c.id}-${agentId}-${date}`, agentId, companyId: c.id, startedAt, finishedAt: new Date(new Date(startedAt).getTime() + durationMs).toISOString(), durationMs, status, goal, steps, outcome };
}

export function agentRuns(companyId: string): AgentRun[] {
  const c = companyById(companyId);
  const pf = portfolio(companyId);
  const runs: AgentRun[] = [];
  const pm = c.systems.pm.toLowerCase().replace(/\s+/g, "_");
  const acct = c.systems.accounting.toLowerCase().replace(/\s+/g, "_");
  const exposureJobs = pf.jobs.filter((j) => j.exposure.count);
  const late = procurementForCompany(companyId).filter((i) => procurementLateDays(i) > 0);
  const subs = subsForCompany(companyId);
  const blocked = subs.filter((s) => subCompliance(s).blocked || subCompliance(s).lienMissing);
  const under = pf.jobs.filter((j) => j.overUnderBilled < -Math.max(60_000, j.project.contractValue * 0.03));

  for (let back = 0; back < 10; back++) {
    const date = addDays(TODAY, -back);
    const today = back === 0;
    const k = (n: number) => n + ((back * 37) % 400);

    // Change Order Chaser
    const coCount = today ? pf.exposure.count : Math.max(0, pf.exposure.count - Math.ceil(back / 3));
    const coApproval = today && exposureJobs.length > 0;
    runs.push(
      mkRun(
        c,
        "co-chaser",
        date,
        "05:00",
        "Find field-started work with no priced change order and get it in front of the owner.",
        [
          step(1, "Pull change events and RFIs", `${pm}.change_events.list`, `${pf.jobs.length} jobs, status ≠ approved`, `${changeOrdersForCompany(companyId).filter((x) => PENDING.has(x.status)).length} open change events`, k(820)),
          step(2, "Match to daily logs and cost postings", `${acct}.job_cost.transactions`, "Last 45 days, cost type L/M/S", `${coCount} events with labour or material already posted`, k(1340)),
          step(3, "Price from original estimate unit rates", "estimate.unit_rates", `${coCount} events`, today && exposureJobs[0] ? `${moneyShort(pf.exposure.value)} estimated value, ${moneyShort(pf.exposure.cost)} cost` : "Estimates refreshed", k(960)),
          step(4, "Draft pricing packages", "docs.compose", coApproval ? `${Math.min(2, exposureJobs[0].exposure.count)} oldest on ${exposureJobs[0].project.name}` : "No new events past threshold", coApproval ? "2 packages with backup and RFI references" : "Nothing to draft", k(1880)),
        ],
        coApproval
          ? { kind: "approval_requested", summary: `Drafted pricing for ${exposureJobs[0].exposure.items.slice(0, 2).map((x) => x.number).join(" and ")} on ${exposureJobs[0].project.name}, sent to Approvals.` }
          : coCount
            ? { kind: "alert_raised", summary: `${coCount} field-started items still unpriced, no new ones past ${DEFAULT_CO_AGING_DAYS} days.` }
            : { kind: "no_action", summary: "Every started change is priced." },
        coApproval ? "needs_approval" : "success",
      ),
    );

    // Cost Forecaster
    const worst = [...pf.jobs].sort((a, b) => a.margin4w - b.margin4w)[0];
    const errored = companyId === "ironwood" && back === 4;
    const costRun = mkRun(
      c,
      "cost-forecaster",
      date,
      "05:10",
      "Re-forecast cost at completion for every active job.",
      [
        step(1, "Load budgets and commitments", `${pm}.budget.export`, `${pf.jobs.length} jobs`, `${pf.jobs.reduce((s, j) => s + j.project.costCodes.length, 0)} cost codes`, k(1120)),
        step(2, "Load actuals", `${acct}.job_cost.summary`, "Through yesterday", errored ? "Timed out after 30 s" : `${moneyShort(pf.jobs.reduce((s, j) => s + j.actual, 0))} posted to date`, errored ? 30_000 : k(1460)),
        ...(errored ? [] : [step(3, "Forecast cost to complete by code", "forecast.cost_to_complete", "Committed, actual, % complete", `Portfolio FAC ${moneyShort(pf.jobs.reduce((s, j) => s + j.fac, 0))}`, k(740)), step(4, "Compare to last week", "forecast.diff", "Weekly snapshot", `${worst.project.name} ${pct(worst.margin4w)} over four weeks`, k(310))]),
      ],
      errored ? { kind: "error", summary: `${c.systems.accounting} did not respond. Retried at 5:40 AM and succeeded.` } : { kind: worst.margin4w < -0.01 ? "alert_raised" : "no_action", summary: worst.margin4w < -0.01 ? `Margin fade flagged on ${worst.project.name}: ${pct(worst.forecastMargin)} forecast.` : "No job moved more than a point this week." },
      errored ? "error" : "success",
    );
    if (errored) costRun.steps[1].status = "error";
    runs.push(costRun);

    // Procurement Watch
    const procApproval = today && late.length > 0;
    runs.push(
      mkRun(
        c,
        "procurement-watch",
        date,
        "05:15",
        "Check every long-lead item against its need-by date.",
        [
          step(1, "Pull submittal and PO log", `${pm}.submittals.list`, "Long-lead flag = true", `${procurementForCompany(companyId).length} items tracked`, k(640)),
          step(2, "Refresh supplier delivery dates", "supplier.portal.status", `${procurementForCompany(companyId).length} items`, `${late.length} landing after need-by`, k(2100)),
          step(3, "Check schedule float", "schedule.float", "Successor activities", late[0] ? `${late[0].item}: on the critical path` : "All items have float", k(520)),
        ],
        procApproval ? { kind: "approval_requested", summary: `Drafted an expedite request to ${late.sort((a, b) => procurementLateDays(b) - procurementLateDays(a))[0].supplier}.` } : { kind: late.length ? "alert_raised" : "no_action", summary: late.length ? `${late.length} item${late.length === 1 ? "" : "s"} still late, no change since yesterday.` : "Everything lands before it's needed." },
        procApproval ? "needs_approval" : "success",
      ),
    );

    // Sub Compliance
    const subApproval = today && blocked.length > 0;
    runs.push(
      mkRun(
        c,
        "sub-compliance",
        date,
        "05:20",
        "Make sure no sub gets paid without clearance, insurance and a lien waiver.",
        [
          step(1, "Pull pay applications", `${acct}.ap.pay_applications`, "Status received or under review", `${pf.payAppsPending.count} pay apps, ${moneyShort(pf.payAppsPending.amount)}`, k(580)),
          step(2, `Check ${c.wcbName} clearance`, "wcb.clearance_lookup", `${subs.length} subs`, `${subs.filter((s) => subCompliance(s).wcbExpired).length} expired`, k(1650)),
          step(3, "Check insurance and lien waivers", `${pm}.compliance.documents`, `${subs.length} subs`, `${subs.filter((s) => subCompliance(s).insSoon).length} certificates expiring in 30 days, ${subs.filter((s) => subCompliance(s).lienMissing).length} waivers missing`, k(870)),
        ],
        subApproval ? { kind: "approval_requested", summary: `Proposed holding payment to ${blocked.map((s) => s.name).join(" and ")}.` } : { kind: "no_action", summary: "All subs with pay apps in are compliant." },
        subApproval ? "needs_approval" : "success",
      ),
    );

    // Billing Assistant
    const billApproval = today && under.length > 0;
    runs.push(
      mkRun(
        c,
        "billing-assistant",
        date,
        "05:25",
        "Compare work in place to billing on every job.",
        [
          step(1, "Load billed to date", `${acct}.ar.progress_billings`, `${pf.jobs.length} jobs`, `${moneyShort(pf.jobs.reduce((s, j) => s + j.project.billedToDate, 0))} billed`, k(690)),
          step(2, "Compute earned revenue", "wip.earned_revenue", "Cost-to-cost % complete", `${moneyShort(pf.jobs.reduce((s, j) => s + j.earnedRevenue, 0))} earned`, k(410)),
          step(3, "Find under-billed jobs", "wip.over_under", "Threshold 3% of contract", `${under.length} job${under.length === 1 ? "" : "s"} underbilled`, k(260)),
        ],
        billApproval ? { kind: "approval_requested", summary: `Drafted a catch-up progress claim for ${under[0].project.name}.` } : { kind: "no_action", summary: "Billing is in line with work in place." },
        billApproval ? "needs_approval" : "success",
      ),
    );

    // Morning Brief
    runs.push(
      mkRun(
        c,
        "morning-brief",
        date,
        "05:45",
        "Write and send the morning brief.",
        [
          step(1, "Collect findings", "orchestrator.findings", "5 agents", today ? `${detectAlerts(companyId).length} alerts, ${pf.exposure.count} unpriced changes` : "Findings collected", k(240)),
          step(2, "Write the brief", "narrator.compose", "Portfolio, top job, schedule, cash", "4 paragraphs", k(2300)),
          step(3, "Send", "whatsapp.send", c.owner.phone, "Delivered 6:00 AM", k(380)),
        ],
        { kind: "brief_sent", summary: `Sent to ${c.owner.name} on WhatsApp at 6:00 AM.` },
        "success",
      ),
    );
  }
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export interface CycleSummary {
  date: string;
  agents: number;
  steps: number;
  approvalsPending: number;
  errors: number;
  runs: AgentRun[];
}

export function lastCycle(companyId: string): CycleSummary {
  const runs = agentRuns(companyId).filter((r) => r.id.endsWith(TODAY)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return { date: TODAY, agents: runs.length, steps: runs.reduce((s, r) => s + r.steps.length, 0), approvalsPending: runs.filter((r) => r.status === "needs_approval").length, errors: runs.filter((r) => r.status === "error").length, runs };
}

// ---------- approvals ----------
export function approvalsFor(companyId: string): Approval[] {
  const c = companyById(companyId);
  const pf = portfolio(companyId);
  const at = (hhmm: string) => localIso(TODAY, hhmm, c.timeZone);
  const runId = (agent: string) => `${companyId}-${agent}-${TODAY}`;
  const out: Approval[] = [];

  const exposureJobs = pf.jobs.filter((j) => j.exposure.count).sort((a, b) => b.exposure.value - a.exposure.value);
  if (exposureJobs[0]) {
    const j = exposureJobs[0];
    for (const x of j.exposure.items.slice(0, 2)) {
      out.push({
        id: `ap-${x.id}`,
        companyId,
        agentId: "co-chaser",
        runId: runId("co-chaser"),
        proposedAt: at("05:04"),
        title: `Send ${x.number} pricing to ${j.project.client}: ${money(x.value)}`,
        summary: `${x.title}. Crews started ${coAgeDays(x)} days ago${x.reference ? ` under ${x.reference}` : ""}. ${money(x.cost)} of cost is already in the forecast with no revenue against it. Priced from the original estimate's unit rates plus 10% overhead and 5% fee.`,
        action: `Email the ${x.number} pricing package to ${j.project.client} and log it as submitted in ${c.systems.pm}.`,
        amount: x.value,
        evidence: [
          { label: "Job", value: j.project.number, href: `/projects/?id=${j.project.id}` },
          { label: "Age", value: `${coAgeDays(x)} days`, href: `/change-orders/?project=${j.project.id}` },
          { label: "Margin if approved", value: `+${pct(x.value / j.revisedContract)}`, href: `/projects/?id=${j.project.id}` },
        ],
        status: "pending",
        confirmation: `Sent to ${j.project.client}. ${x.number} is now submitted in ${c.systems.pm}.`,
      });
    }
  }

  const late = procurementForCompany(companyId).filter((i) => procurementLateDays(i) > 0).sort((a, b) => procurementLateDays(b) - procurementLateDays(a))[0];
  if (late) {
    const p = projectById(late.projectId)!;
    out.push({
      id: `ap-${late.id}`,
      companyId,
      agentId: "procurement-watch",
      runId: runId("procurement-watch"),
      proposedAt: at("05:17"),
      title: `Ask ${late.supplier} to expedite the ${lcFirst(late.item)}`,
      summary: `${p.name} needs it ${shortDate(late.needBy)}; the supplier is showing ${shortDate(late.expectedDelivery)}, ${procurementLateDays(late)} days late. The request asks for a firm ship date, partial shipment options and the cost of air freight.`,
      action: `Email ${late.supplier} the expedite request and copy ${p.pm}.`,
      evidence: [
        { label: "Job", value: p.number, href: `/projects/?id=${p.id}` },
        { label: "Late by", value: `${procurementLateDays(late)} days`, href: "/schedule/" },
        { label: "Lead time", value: `${late.leadWeeks} wks`, href: "/schedule/" },
      ],
      status: "pending",
      confirmation: `Expedite request sent to ${late.supplier}. ${p.pm} is copied.`,
    });
  }

  for (const s of subsForCompany(companyId)) {
    const k = subCompliance(s);
    if (!(k.blocked || k.lienMissing) || !s.payApp.amount || s.payApp.status === "paid") continue;
    const why = k.wcbExpired ? `${c.wcbName} clearance expired ${-k.wcbDays} days ago` : "the lien waiver for the last payment is missing";
    out.push({
      id: `ap-hold-${s.id}`,
      companyId,
      agentId: "sub-compliance",
      runId: runId("sub-compliance"),
      proposedAt: at("05:22"),
      title: `Hold ${possessive(s.name)} ${money(s.payApp.amount)} pay application`,
      summary: `Paying now would expose you: ${why}. The agent will hold the payment and email ${s.name} for the missing document. It releases automatically once it's on file.`,
      action: `Put the pay application on hold in ${c.systems.accounting} and request the document from ${s.name}.`,
      amount: s.payApp.amount,
      evidence: [
        { label: "Trade", value: s.trade, href: "/payments/" },
        { label: k.wcbExpired ? c.wcbName : "Lien waiver", value: k.wcbExpired ? "Expired" : "Missing", href: "/payments/" },
      ],
      status: "pending",
      confirmation: `Payment held in ${c.systems.accounting}. ${s.name} has been asked for the document.`,
    });
  }

  const under = pf.jobs.filter((j) => j.overUnderBilled < -Math.max(60_000, j.project.contractValue * 0.03)).sort((a, b) => a.overUnderBilled - b.overUnderBilled)[0];
  if (under) {
    out.push({
      id: `ap-bill-${under.project.id}`,
      companyId,
      agentId: "billing-assistant",
      runId: runId("billing-assistant"),
      proposedAt: at("05:27"),
      title: `Add ${moneyShort(-under.overUnderBilled)} to the ${under.project.name} progress claim`,
      summary: `Work in place is ${pct(under.project.pctComplete, 0)} complete but billing is behind by ${money(-under.overUnderBilled)}. The draft claim updates the schedule of values line by line from cost-to-cost progress.`,
      action: `Create the draft progress claim in ${c.systems.accounting} for ${under.project.pm} to review.`,
      amount: -under.overUnderBilled,
      evidence: [
        { label: "Earned", value: moneyShort(under.earnedRevenue), href: "/payments/" },
        { label: "Billed", value: moneyShort(under.project.billedToDate), href: "/payments/" },
      ],
      status: "pending",
      confirmation: `Draft claim created in ${c.systems.accounting} and assigned to ${under.project.pm}.`,
    });
  }

  // One resolved item so the Done tab isn't empty.
  out.push({
    id: `ap-done-${companyId}`,
    companyId,
    agentId: "co-chaser",
    proposedAt: localIso(addDays(TODAY, -2), "05:03", c.timeZone),
    title: `Send ${changeOrdersForCompany(companyId).find((x) => x.status === "submitted")?.number ?? "CO"} pricing to the owner`,
    summary: "Pricing package with backup and RFI references.",
    action: "Email the pricing package and log it as submitted.",
    evidence: [],
    status: "approved",
    resolvedAt: localIso(addDays(TODAY, -2), "07:41", c.timeZone),
    confirmation: "Sent and logged as submitted.",
  });

  return out;
}

export function integrationSyncIso(companyId: string, minute: number): string {
  return localIso(TODAY, `05:${String(30 + minute).padStart(2, "0")}`, companyById(companyId).timeZone);
}

// Warm the cache so every project carries its margin history from the first read.
WORLD.projects.forEach(projectFinancials);
