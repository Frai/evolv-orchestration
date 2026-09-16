import type { Agent, AgentRun, AgentStep, Alert, Approval, LabourDay, Location, SalesDay, StockLevel } from "@/core/types";
import { WEEKDAY_LONG, addDays, weekday } from "@/core/dates";
import { hours, int, money, pct } from "@/core/format";
import { flaggedShifts, labourPct } from "@/core/labour";
import { reorderCost, reorderQty, sortByUrgency, stockStatus } from "@/core/inventory";
import type { ItemTotal } from "@/core/sales";
import { Rng, hashSeed } from "./rng";

export const AGENTS: Agent[] = [
  {
    id: "morning-brief",
    name: "Morning Brief",
    description: "Reads yesterday's sales and labour, writes the brief, and delivers it before you open the app.",
    status: "active",
    schedule: "Daily at 5:45 AM",
    defaultMode: "auto",
  },
  {
    id: "sales-watch",
    name: "Sales Watch",
    description: "Compares every day against its weekday baseline, flags drops and spikes, and reviews the menu weekly.",
    status: "active",
    schedule: "Daily at 5:15 AM, menu review Mondays",
    defaultMode: "ask_first",
  },
  {
    id: "labour-optimizer",
    name: "Labour Optimizer",
    description: "Checks the upcoming schedule against hourly sales and proposes shift changes when staffing drifts from demand.",
    status: "active",
    schedule: "Daily at 5:30 AM",
    defaultMode: "ask_first",
  },
  {
    id: "inventory-guard",
    name: "Inventory Guard",
    description: "Watches par levels and days of cover, and drafts reorders with your suppliers before you run out.",
    status: "active",
    schedule: "Daily at 5:00 AM",
    defaultMode: "ask_first",
  },
  {
    id: "guest-pulse",
    name: "Guest Pulse",
    description: "Reads reviews and reservation notes to surface what guests are saying about service, food and wait times.",
    status: "coming_soon",
    schedule: "Weekly",
    defaultMode: "auto",
  },
  {
    id: "finance-insights",
    name: "Finance Insights",
    description: "Pulls your accounting data to show prime cost, cash position and month-end forecasts.",
    status: "coming_soon",
    schedule: "Weekly",
    defaultMode: "auto",
  },
];

export interface RunContext {
  location: Location;
  dates: string[];
  asOf: string;
  salesDays: SalesDay[];
  labourDays: LabourDay[];
  stock: StockLevel[];
  alertsByDate: Map<string, Alert[]>;
  deadItems: ItemTotal[];
  overstaffedTuesdays: string[];
  recipients: string[];
  channelLabel: string;
  sevenShifts: boolean;
}

/** Local ISO timestamp for Calgary (MDT in the demo window). */
export function localIso(date: string, hh: number, mm: number, ss = 0): string {
  return `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}-06:00`;
}

function finish(startedAt: string, steps: AgentStep[]): { finishedAt: string; durationMs: number } {
  const total = steps.reduce((a, s) => a + s.durationMs, 0) + 120;
  return { finishedAt: new Date(new Date(startedAt).getTime() + total).toISOString(), durationMs: total };
}

export interface RunOutput {
  runs: AgentRun[];
  approvals: Approval[];
}

export function generateRuns(c: RunContext): RunOutput {
  const rng = new Rng(hashSeed(`runs:${c.location.id}`));
  const runs: AgentRun[] = [];
  const approvals: Approval[] = [];
  const loc = c.location;
  const last30 = c.dates.slice(-30);
  const ms = (a: number, b: number) => rng.int(a, b);

  // Days on which each planted approval was proposed.
  const reorderDay = c.asOf; // last night
  const scheduleDay = c.overstaffedTuesdays[0]; // the morning after the most recent overstaffed Tuesday
  const menuDay = (() => {
    // The most recent Monday review, at least 2 days back.
    for (let i = c.dates.length - 3; i >= 0; i--) if (weekday(c.dates[i]) === 0) return c.dates[i]; // runs Monday morning for Sunday's close
    return c.dates[c.dates.length - 3];
  })();
  const earlyReorderDay = c.dates[c.dates.length - 10];
  const rejectedScheduleDay = c.dates[c.dates.length - 17];
  const errorDay = c.dates[c.dates.length - 13];

  const urgent = sortByUrgency(c.stock).filter((s) => ["critical", "below_par"].includes(stockStatus(s)));
  const criticalItem = urgent[0];

  for (const date of last30) {
    const runDate = addDays(date, 1); // agents run early the next morning
    const day = c.salesDays.find((d) => d.date === date)!;
    const labour = c.labourDays.find((l) => l.date === date);
    const alerts = c.alertsByDate.get(date) ?? [];
    const lp = labourPct(labour, day);
    const wd = WEEKDAY_LONG[weekday(date)];

    // ---------------- Inventory Guard 05:00
    {
      const startedAt = localIso(runDate, 5, 0, rng.int(0, 40));
      const isLast = date === reorderDay;
      const isEarly = date === earlyReorderDay;
      const belowCount = isLast ? urgent.length : isEarly ? 2 : rng.chance(0.15) ? 1 : 0;
      const steps: AgentStep[] = [
        {
          index: 1,
          title: "Pull current stock counts",
          tool: "InventorySource.getStockLevels",
          inputSummary: `location=${loc.id}`,
          outputSummary: `${c.stock.length} tracked items, last counted ${date} 23:10`,
          durationMs: ms(380, 900),
          status: "ok",
        },
        {
          index: 2,
          title: "Compare against par and days of cover",
          tool: "Inventory.evaluate",
          inputSummary: `${c.stock.length} items, rule: on hand < par`,
          outputSummary: isLast
            ? `${urgent.length} below par, ${urgent.filter((u) => stockStatus(u) === "critical").length} critical (${criticalItem.name}: ${criticalItem.onHand} ${criticalItem.unit} vs par ${criticalItem.par})`
            : belowCount
              ? `${belowCount} below par, 0 critical`
              : "All items at or above par",
          durationMs: ms(40, 120),
          status: "ok",
        },
      ];
      let status: AgentRun["status"] = "success";
      let outcome: AgentRun["outcome"] = { kind: "no_action", summary: "Stock within par. Nothing to order." };
      if (isLast) {
        const q = reorderQty(criticalItem);
        const cost = reorderCost(criticalItem);
        steps.push({
          index: 3,
          title: "Draft reorder for approval",
          tool: "Approvals.propose",
          inputSummary: `${criticalItem.name}, ${q} ${criticalItem.unit}, ${criticalItem.supplier}`,
          outputSummary: `Approval ${loc.id}-reorder-1 created (${money(cost)})`,
          durationMs: ms(60, 140),
          status: "ok",
        });
        status = "needs_approval";
        outcome = { kind: "approval_requested", summary: `Reorder ${q} ${criticalItem.unit} ${criticalItem.name} from ${criticalItem.supplier} (${money(cost)}) is waiting for approval.` };
        const runId = `${loc.id}:${runDate}:inventory-guard`;
        approvals.push({
          id: `${loc.id}-reorder-1`,
          locationId: loc.id,
          agentId: "inventory-guard",
          runId,
          title: `Reorder ${q} ${criticalItem.unit} ${criticalItem.name.toLowerCase()} from ${criticalItem.supplier} (${money(cost)})`,
          summary: `${criticalItem.name} is at ${criticalItem.onHand} ${criticalItem.unit} against a par of ${criticalItem.par}, with ${(criticalItem.onHand / criticalItem.dailyUsage).toFixed(1)} days of cover at ${criticalItem.dailyUsage} ${criticalItem.unit}/day. ${criticalItem.supplier} delivers next morning on orders placed before 2 PM.`,
          amount: cost,
          evidence: [
            { label: "On hand", value: `${criticalItem.onHand} ${criticalItem.unit}`, href: "/inventory/" },
            { label: "Par level", value: `${criticalItem.par} ${criticalItem.unit}`, href: "/inventory/" },
            { label: "Daily usage", value: `${criticalItem.dailyUsage} ${criticalItem.unit}/day`, href: "/inventory/" },
            { label: "Days of cover", value: `${(criticalItem.onHand / criticalItem.dailyUsage).toFixed(1)}`, href: "/inventory/" },
            { label: "Unit cost", value: `${money(criticalItem.unitCost)}/${criticalItem.unit}`, href: "/inventory/" },
          ],
          status: "pending",
          proposedAt: startedAt,
          confirmation: `Sent to ${criticalItem.supplier} via email. Delivery expected tomorrow before 10 AM.`,
          action: `Email purchase order to ${criticalItem.supplier}: ${q} ${criticalItem.unit} ${criticalItem.name.toLowerCase()}, deliver next morning.`,
        });
      } else if (isEarly) {
        const item = c.stock[3];
        const q = reorderQty(item);
        const cost = reorderCost(item);
        steps.push({
          index: 3,
          title: "Draft reorder for approval",
          tool: "Approvals.propose",
          inputSummary: `${item.name}, ${q} ${item.unit}, ${item.supplier}`,
          outputSummary: `Approval ${loc.id}-reorder-0 created (${money(cost)})`,
          durationMs: ms(60, 140),
          status: "ok",
        });
        status = "needs_approval";
        outcome = { kind: "approval_requested", summary: `Reorder ${q} ${item.unit} ${item.name} from ${item.supplier} (${money(cost)}) was approved the same morning.` };
        approvals.push({
          id: `${loc.id}-reorder-0`,
          locationId: loc.id,
          agentId: "inventory-guard",
          runId: `${loc.id}:${runDate}:inventory-guard`,
          title: `Reorder ${q} ${item.unit} ${item.name.toLowerCase()} from ${item.supplier} (${money(cost)})`,
          summary: `${item.name} dropped to 60% of par after a busy weekend.`,
          amount: cost,
          evidence: [
            { label: "On hand at the time", value: `${Math.round(item.par * 0.6)} ${item.unit}`, href: "/inventory/" },
            { label: "Par level", value: `${item.par} ${item.unit}`, href: "/inventory/" },
          ],
          status: "approved",
          proposedAt: startedAt,
          resolvedAt: localIso(runDate, 7, 12),
          confirmation: `Sent to ${item.supplier} via email. Delivered ${addDays(runDate, 1)}.`,
          action: `Email purchase order to ${item.supplier}: ${q} ${item.unit} ${item.name.toLowerCase()}.`,
        });
      } else if (belowCount) {
        outcome = { kind: "no_action", summary: `${belowCount} item slightly below par, more than 3 days of cover. Will re-check tomorrow.` };
      }
      const f = finish(startedAt, steps);
      runs.push({
        id: `${loc.id}:${runDate}:inventory-guard`,
        agentId: "inventory-guard",
        locationId: loc.id,
        startedAt,
        ...f,
        status,
        goal: `Make sure nothing runs out before the next delivery window.`,
        steps,
        outcome,
      });
    }

    // ---------------- Sales Watch 05:15
    {
      const startedAt = localIso(runDate, 5, 15, rng.int(0, 40));
      const salesAlerts = alerts.filter((a) => a.source === "sales");
      const isMenuReview = date === menuDay;
      const steps: AgentStep[] = [
        {
          index: 1,
          title: "Fetch 90 days of sales",
          tool: "SalesSource.getSalesDays",
          inputSummary: `location=${loc.id}, range=${addDays(date, -89)}..${date}`,
          outputSummary: `90 days · ${wd} ${date}: ${money(day.netSales)} net, ${int(day.covers)} covers`,
          durationMs: ms(600, 1400),
          status: "ok",
        },
        {
          index: 2,
          title: "Evaluate against weekday baseline",
          tool: "Alerts.detect",
          inputSummary: `rules: drop ≤ −15%, spike ≥ +25%, dead items < 2/wk`,
          outputSummary: salesAlerts.length ? salesAlerts.map((a) => a.title).join("; ") : "Within normal range",
          durationMs: ms(30, 90),
          status: "ok",
        },
      ];
      let status: AgentRun["status"] = "success";
      let outcome: AgentRun["outcome"] = salesAlerts.length
        ? { kind: "alert_raised", summary: `${salesAlerts.length} alert${salesAlerts.length === 1 ? "" : "s"} added to the morning brief.` }
        : { kind: "no_action", summary: `${wd} was within its normal range.` };
      if (isMenuReview) {
        const dead = c.deadItems[0];
        steps.push({
          index: 3,
          title: "Weekly menu review",
          tool: "SalesSource.getItemSales",
          inputSummary: `range=${addDays(date, -29)}..${date}, ${loc.menuItemCount} items`,
          outputSummary: `${c.deadItems.length} items under 2/week: ${c.deadItems.map((d) => d.name).join(", ")}`,
          durationMs: ms(500, 1100),
          status: "ok",
        });
        steps.push({
          index: 4,
          title: "Propose menu change",
          tool: "Approvals.propose",
          inputSummary: `remove "${dead.name}" (${int(dead.qty)} sold in 30 days)`,
          outputSummary: `Approval ${loc.id}-menu-1 created`,
          durationMs: ms(50, 120),
          status: "ok",
        });
        status = "needs_approval";
        outcome = { kind: "approval_requested", summary: `Proposed removing ${dead.name} from the menu.` };
        approvals.push({
          id: `${loc.id}-menu-1`,
          locationId: loc.id,
          agentId: "sales-watch",
          runId: `${loc.id}:${runDate}:sales-watch`,
          title: `Remove '${dead.name}' from menu (sold ${int(dead.qty)} in 30 days)`,
          summary: `${dead.name} sold ${int(dead.qty)} times in the last 30 days for ${money(dead.netSales)}, about ${dead.perWeek.toFixed(1)} a week. It ties up prep and a dedicated ingredient. Removing it has no measurable revenue impact.`,
          evidence: [
            { label: "Sold, last 30 days", value: `${int(dead.qty)}`, href: "/sales/" },
            { label: "Revenue, last 30 days", value: money(dead.netSales), href: "/sales/" },
            { label: "Per week", value: dead.perWeek.toFixed(1), href: "/sales/" },
            { label: "Menu price", value: money(dead.price), href: "/sales/" },
          ],
          status: "pending",
          proposedAt: startedAt,
          confirmation: `Menu update queued in ${loc.pos === "toast" ? "Toast" : loc.pos === "square" ? "Square" : "Lightspeed"}. ${dead.name} is 86'd from tomorrow's service.`,
          action: `Remove "${dead.name}" from the ${dead.category.toLowerCase()} section of the menu and the POS.`,
        });
      }
      const f = finish(startedAt, steps);
      runs.push({
        id: `${loc.id}:${runDate}:sales-watch`,
        agentId: "sales-watch",
        locationId: loc.id,
        startedAt,
        ...f,
        status,
        goal: `Catch anything unusual in ${wd}'s sales before the owner sees the numbers.`,
        steps,
        outcome,
      });
    }

    // ---------------- Labour Optimizer 05:30
    {
      const startedAt = localIso(runDate, 5, 30, rng.int(0, 40));
      const over = labour ? flaggedShifts([labour], "overstaffed") : [];
      const under = labour ? flaggedShifts([labour], "understaffed") : [];
      const isProposal = date === scheduleDay;
      const isRejected = date === rejectedScheduleDay;
      const steps: AgentStep[] = [
        {
          index: 1,
          title: "Fetch upcoming schedule",
          tool: "LabourSource.getLabourDays",
          inputSummary: `location=${loc.id}, range=${runDate}..${addDays(runDate, 6)}`,
          outputSummary: `${labour ? labour.shifts.length * 7 : 0} shifts, ${labour ? hours(labour.scheduledHours * 7) : "0 h"} scheduled`,
          durationMs: ms(400, 900),
          status: "ok",
        },
        {
          index: 2,
          title: "Fetch hourly sales, last 8 weeks",
          tool: "SalesSource.getSalesDays",
          inputSummary: `range=${addDays(date, -55)}..${date}, hourly`,
          outputSummary: `56 days × 13 hours; ${wd} ${date}: ${lp !== null ? pct(lp) : "n/a"} labour`,
          durationMs: ms(500, 1200),
          status: "ok",
        },
        {
          index: 3,
          title: "Compare staffing to demand",
          tool: "Labour.evaluate",
          inputSummary: `tolerance: ±1 head per shift, target ${pct(loc.targetLabourPct, 0)}`,
          outputSummary: over.length
            ? `${over.length} overstaffed: ${over.map((o) => `${o.shift.role} ${o.shift.start}–${o.shift.end} (+${o.excessStaff})`).join(", ")}`
            : under.length
              ? `${under.length} understaffed: ${under.map((u) => `${u.shift.role} ${u.shift.start}–${u.shift.end} (−${-u.excessStaff})`).join(", ")}`
              : "Every shift within one head of demand",
          durationMs: ms(40, 110),
          status: "ok",
        },
      ];
      let status: AgentRun["status"] = "success";
      let outcome: AgentRun["outcome"] = over.length || under.length ? { kind: "alert_raised", summary: "Noted in the morning brief. No change proposed yet." } : { kind: "no_action", summary: "Schedule within tolerance." };
      if (isProposal && over.length) {
        const o = over[0];
        const tuesdays = c.overstaffedTuesdays;
        const savings = o.costImpact / 2; // cutting one of the two extra heads
        steps.push({
          index: 4,
          title: "Propose schedule change",
          tool: "Approvals.propose",
          inputSummary: `Tue ${o.shift.start}–${o.shift.end}, ${o.shift.role.toLowerCase()} −1`,
          outputSummary: `Approval ${loc.id}-schedule-1 created (${money(savings)}/week)`,
          durationMs: ms(50, 120),
          status: "ok",
        });
        status = "needs_approval";
        outcome = { kind: "approval_requested", summary: `Proposed cutting one ${o.shift.role.toLowerCase()} from Tuesday ${o.shift.start}–${o.shift.end}.` };
        approvals.push({
          id: `${loc.id}-schedule-1`,
          locationId: loc.id,
          agentId: "labour-optimizer",
          runId: `${loc.id}:${runDate}:labour-optimizer`,
          title: `Cut one ${o.shift.role.toLowerCase()} from Tue ${o.shift.start}–${o.shift.end} shift`,
          summary: `The last two Tuesday lunches (${tuesdays.join(" and ")}) ran ${o.shift.actualStaff} ${o.shift.role.toLowerCase()}s for about ${money(o.shift.salesInWindow)} in sales; ${o.shift.neededStaff} would have covered it. Dropping one head saves roughly ${money(savings)} a week, ${money(savings * 52)} a year, with no change to Friday or Saturday.`,
          amount: savings,
          evidence: [
            { label: `Staff on ${tuesdays[0]}`, value: `${o.shift.actualStaff} (needed ${o.shift.neededStaff})`, href: "/labour/" },
            { label: "Sales in window", value: money(o.shift.salesInWindow), href: "/labour/" },
            { label: "Avoidable labour", value: `${money(o.costImpact)} per Tuesday`, href: "/labour/" },
            { label: "Weekly saving (−1 head)", value: money(savings), href: "/labour/" },
          ],
          status: "pending",
          proposedAt: startedAt,
          confirmation: c.sevenShifts ? "Schedule updated in 7shifts. Affected staff notified for next Tuesday." : "Draft schedule change sent to the manager for next Tuesday.",
          action: `Reduce Tuesday ${o.shift.start}–${o.shift.end} ${o.shift.role.toLowerCase()} shift from ${o.shift.actualStaff} to ${o.shift.actualStaff - 1} starting next week.`,
        });
      } else if (isRejected && labour) {
        const s = labour.shifts.find((x) => x.role.toLowerCase().includes("server") || x.role.toLowerCase().includes("cashier") || x.role.toLowerCase().includes("bartender")) ?? labour.shifts[0];
        steps.push({
          index: 4,
          title: "Propose schedule change",
          tool: "Approvals.propose",
          inputSummary: `${wd} ${s.start}–${s.end}, ${s.role.toLowerCase()} −1`,
          outputSummary: `Approval ${loc.id}-schedule-0 created`,
          durationMs: ms(50, 120),
          status: "ok",
        });
        status = "needs_approval";
        outcome = { kind: "approval_requested", summary: `Proposed trimming the ${wd} ${s.start}–${s.end} shift. Rejected by the owner.` };
        approvals.push({
          id: `${loc.id}-schedule-0`,
          locationId: loc.id,
          agentId: "labour-optimizer",
          runId: `${loc.id}:${runDate}:labour-optimizer`,
          title: `Cut one ${s.role.toLowerCase()} from ${WEEKDAY_LONG[weekday(date)].slice(0, 3)} ${s.start}–${s.end} shift`,
          summary: `Sales in the window were ${money(s.salesInWindow)} with ${s.actualStaff} on.`,
          evidence: [{ label: "Sales in window", value: money(s.salesInWindow), href: "/labour/" }],
          status: "rejected",
          proposedAt: startedAt,
          resolvedAt: localIso(runDate, 8, 41),
          confirmation: "Rejected. Owner note: keep the section covered during the private-event season.",
          action: `Reduce ${wd} ${s.start}–${s.end} ${s.role.toLowerCase()} shift by one.`,
        });
      }
      const f = finish(startedAt, steps);
      runs.push({
        id: `${loc.id}:${runDate}:labour-optimizer`,
        agentId: "labour-optimizer",
        locationId: loc.id,
        startedAt,
        ...f,
        status,
        goal: `Keep labour near ${pct(loc.targetLabourPct, 0)} without leaving the floor short.`,
        steps,
        outcome,
      });
    }

    // ---------------- Morning Brief 05:45 (+ a failed delivery and retry on one day)
    {
      const attempts = date === errorDay ? 2 : 1;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        const failed = attempts === 2 && attempt === 1;
        const startedAt = attempt === 1 ? localIso(runDate, 5, 45, rng.int(0, 40)) : localIso(runDate, 6, 10, rng.int(0, 40));
        const steps: AgentStep[] = [
          {
            index: 1,
            title: "Fetch yesterday's sales",
            tool: "SalesSource.getSalesDays",
            inputSummary: `location=${loc.id}, date=${date}`,
            outputSummary: `${money(day.netSales)} net · ${int(day.covers)} covers · ${int(day.orders)} orders`,
            durationMs: ms(300, 800),
            status: "ok",
          },
          {
            index: 2,
            title: "Fetch yesterday's labour",
            tool: "LabourSource.getLabourDays",
            inputSummary: `location=${loc.id}, date=${date}`,
            outputSummary: labour ? `${hours(labour.actualHours)} actual · ${money(labour.labourCost)} · ${lp !== null ? pct(lp) : "n/a"} of sales` : "no data",
            durationMs: ms(250, 700),
            status: "ok",
          },
          {
            index: 3,
            title: "Write the brief",
            tool: "Narrator.compose",
            inputSummary: `deltas vs 4-week ${wd} baseline, ${alerts.length} alert${alerts.length === 1 ? "" : "s"}`,
            outputSummary: `${4 + (rng.chance(0.4) ? 1 : 0)} paragraphs · ${rng.int(120, 190)} words`,
            durationMs: ms(1800, 4200),
            status: "ok",
          },
          {
            index: 4,
            title: `Send via ${c.channelLabel}`,
            tool: "Notifier.send",
            inputSummary: `${c.channelLabel} → ${c.recipients.join(", ")}`,
            outputSummary: failed ? "Gateway timeout (504) after 30 s. Scheduled retry at 6:10 AM." : `Delivered ${attempt === 1 ? "6:00" : "6:11"} AM`,
            durationMs: failed ? 30000 : ms(700, 1900),
            status: failed ? "error" : "ok",
          },
        ];
        const f = finish(startedAt, steps);
        runs.push({
          id: `${loc.id}:${runDate}:morning-brief${attempt === 2 ? ":retry" : ""}`,
          agentId: "morning-brief",
          locationId: loc.id,
          startedAt,
          ...f,
          status: failed ? "error" : "success",
          goal: `Deliver the ${wd} brief to ${loc.owner.name.split(" ")[0]} by 6:00 AM.`,
          steps,
          outcome: failed
            ? { kind: "error", summary: "Delivery failed on the messaging gateway. Retried automatically at 6:10 AM." }
            : { kind: "brief_sent", summary: `Brief delivered to ${c.channelLabel} at ${attempt === 1 ? "6:00" : "6:11"} AM.` },
        });
      }
    }
  }

  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  approvals.sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));
  return { runs, approvals };
}
