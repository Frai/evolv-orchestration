import { describe, expect, it } from "vitest";
import type { ChangeOrder, Commitment, Equipment, FieldTicket, Invoice, SafetyEvent } from "../domain";
import { detectAlerts, type AlertInput } from "./alerts";
import { COMPANY, JOB, code, day } from "./test-helpers";

/** A healthy ten-day job, 50% done and on budget, nothing stuck. Tests perturb one thing at a time. */
function baseInput(over: Partial<AlertInput> = {}): AlertInput {
  return {
    company: COMPANY,
    date: "2026-01-05",
    jobs: [JOB],
    codes: [code()],
    costDays: [day({ date: "2026-01-03", qty: 50, cost: 40_000, hours: 100, overtimeHours: 5 })],
    tickets: [],
    invoices: [{ id: "i1", jobId: "job-1", number: "INV-1", periodEnd: "2026-01-05", amount: 500_000, status: "issued" } as Invoice],
    changeOrders: [],
    equipment: [],
    commitments: [],
    safety: [],
    ...over,
  };
}

const sources = (input: AlertInput) => detectAlerts(input).map((a) => a.source);

describe("detectAlerts: healthy job", () => {
  it("raises nothing", () => {
    expect(detectAlerts(baseInput())).toEqual([]);
  });
});

describe("margin erosion", () => {
  it("warns when forecast margin falls below target and shows the evidence", () => {
    // CPI 0.5 on a $100k budget: EAC $200k against a $1M contract is still 80% margin, so use a thin contract.
    const input = baseInput({ jobs: [{ ...JOB, contractValue: 120_000 }], costDays: [day({ date: "2026-01-03", qty: 50, cost: 80_000 })] });
    const margin = detectAlerts(input).find((a) => a.source === "margin" && a.title.includes("forecast margin"));
    expect(margin).toBeDefined();
    expect(margin?.severity).toBe("critical");
    expect(margin?.owner).toBe("Project manager");
    expect(margin?.evidence.map((e) => e.label)).toContain("Estimate at completion");
    expect(margin?.suggestedAction).toMatch(/Review/);
  });

  it("stays quiet until the job has earned enough for a forecast to mean something", () => {
    const input = baseInput({ jobs: [{ ...JOB, contractValue: 120_000 }], costDays: [day({ date: "2026-01-01", qty: 2, cost: 9_000 })] });
    expect(detectAlerts(input).some((a) => a.title.includes("forecast margin"))).toBe(false);
  });

  it("flags a single cost code running badly in the trailing window before the job rolls up bad", () => {
    const codes = [code({ budget: 400_000, plannedQty: 400 })];
    const costDays = [day({ date: "2026-01-03", qty: 10, cost: 30_000 }), day({ date: "2026-01-04", qty: 10, cost: 30_000 })];
    const a = detectAlerts(baseInput({ codes, costDays })).find((x) => x.title.includes("running at CPI"));
    expect(a?.severity).toBe("warning");
    expect(a?.owner).toBe("Superintendent");
  });
});

describe("overtime", () => {
  it("raises a warning above the threshold and critical well above it", () => {
    const mk = (ot: number) => baseInput({ costDays: [day({ date: "2026-01-03", qty: 50, cost: 40_000, hours: 400, overtimeHours: ot })] });
    expect(detectAlerts(mk(100)).find((a) => a.source === "labour")?.severity).toBe("warning");
    expect(detectAlerts(mk(140)).find((a) => a.source === "labour")?.severity).toBe("critical");
    expect(sources(mk(20))).not.toContain("labour");
  });
  it("ignores thin weeks with too few hours to mean anything", () => {
    const input = baseInput({ costDays: [day({ date: "2026-01-03", qty: 50, cost: 40_000, hours: 50, overtimeHours: 40 })] });
    expect(sources(input)).not.toContain("labour");
  });
});

describe("billing lag", () => {
  it("warns when much more has been earned than invoiced", () => {
    const input = baseInput({ invoices: [] });
    const a = detectAlerts(input).find((x) => x.source === "billing");
    expect(a?.severity).toBe("critical");
    expect(a?.owner).toBe("Controller");
  });
});

describe("change orders", () => {
  const extra = code({ id: "x", code: "99-100", name: "Rock excavation", budget: 0, plannedQty: 0, extra: true });
  const days = [day({ codeId: "x", date: "2026-01-03", hours: 200, cost: 60_000 })];

  it("flags hours booked to extra-work codes with no change order", () => {
    const a = detectAlerts(baseInput({ codes: [code(), extra], costDays: [...baseInput().costDays, ...days] })).find((x) => x.source === "change_orders");
    expect(a?.severity).toBe("critical");
    expect(a?.evidence).toContainEqual({ label: "Change orders on file", value: "0" });
  });

  it("clears once a change order is on file", () => {
    const co: ChangeOrder = { id: "co", jobId: "job-1", number: "CO-1", title: "t", amount: 70_000, status: "pending", codeId: "x", createdAt: "2026-01-04" };
    expect(sources(baseInput({ codes: [code(), extra], costDays: [...baseInput().costDays, ...days], changeOrders: [co] }))).not.toContain("change_orders");
  });
});

describe("field tickets", () => {
  const t = (over: Partial<FieldTicket> = {}): FieldTicket => ({
    id: "t1", companyId: "foothills", jobId: "job-1", number: "FT-1", date: "2026-01-01", crew: "C", description: "d",
    labourHours: 1, equipmentHours: 1, amount: 20_000, status: "open", ...over,
  });
  it("raises one rolled-up alert for tickets stuck before billing", () => {
    const alerts = detectAlerts(baseInput({ tickets: [t(), t({ id: "t2", status: "disputed" })] })).filter((a) => a.source === "tickets");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].title).toContain("$40.0k");
  });
  it("stays quiet when tickets are young or already submitted", () => {
    expect(sources(baseInput({ tickets: [t({ date: "2026-01-05" }), t({ id: "t2", status: "submitted" })] }))).not.toContain("tickets");
  });
});

describe("equipment", () => {
  const unit = (over: Partial<Equipment> = {}): Equipment => ({
    id: "e", jobId: "job-1", name: "CAT 336 excavator", type: "excavator", ownership: "rented", dailyRate: 1_500,
    usageHours14: [9, 9, 9, 9, 9, 9, 9, 0, 0, 0, 0, 0, 0, 0], ...over,
  });
  it("flags rented iron idle most of the week and prices the burn", () => {
    const a = detectAlerts(baseInput({ equipment: [unit()] })).find((x) => x.source === "equipment");
    expect(a?.title).toContain("idle 7 of the last 7 days");
    expect(a?.evidence).toContainEqual({ label: "Idle burn this week", value: "$10,500" });
  });
  it("does not flag owned equipment as rental burn", () => {
    expect(sources(baseInput({ equipment: [unit({ ownership: "owned" })] }))).not.toContain("equipment");
  });
  it("notes a service falling due this week", () => {
    const busy = unit({ usageHours14: Array(14).fill(9), serviceDueDate: "2026-01-08" });
    const a = detectAlerts(baseInput({ equipment: [busy] })).find((x) => x.source === "equipment");
    expect(a?.severity).toBe("info");
  });
});

describe("materials", () => {
  const po = (over: Partial<Commitment> = {}): Commitment => ({
    id: "p", jobId: "job-1", vendor: "Tenaris", description: "NPS 16 line pipe", kind: "po", committed: 400_000, invoiced: 0,
    promisedDate: "2026-01-20", needDate: "2026-01-10", status: "open", ...over,
  });
  it("flags a delivery promised after the need date, critical when the slip is a week or more", () => {
    expect(detectAlerts(baseInput({ commitments: [po()] })).find((a) => a.source === "materials")?.severity).toBe("critical");
    expect(detectAlerts(baseInput({ commitments: [po({ promisedDate: "2026-01-12" })] })).find((a) => a.source === "materials")?.severity).toBe("warning");
  });
  it("ignores deliveries that land in time", () => {
    expect(sources(baseInput({ commitments: [po({ promisedDate: "2026-01-09" })] }))).not.toContain("materials");
  });
});

describe("safety", () => {
  const ev = (over: Partial<SafetyEvent> = {}): SafetyEvent => ({
    id: "s", jobId: "job-1", kind: "inspection_finding", date: "2025-12-20", title: "Trench shoring gap", owner: "Superintendent",
    correctiveDue: "2025-12-30", status: "open", ...over,
  });
  it("escalates an overdue corrective action to the owner without deciding anything", () => {
    const a = detectAlerts(baseInput({ safety: [ev()] })).find((x) => x.source === "safety");
    expect(a?.severity).toBe("warning");
    expect(a?.detail).toMatch(/supervisor decides/);
    expect(detectAlerts(baseInput({ safety: [ev({ kind: "incident" })] })).find((x) => x.source === "safety")?.severity).toBe("critical");
  });
  it("is quiet for closed or not-yet-due actions", () => {
    expect(sources(baseInput({ safety: [ev({ status: "closed" }), ev({ id: "s2", correctiveDue: "2026-01-20" })] }))).not.toContain("safety");
  });
});

describe("ordering", () => {
  it("sorts critical before warning before info", () => {
    const input = baseInput({
      invoices: [],
      equipment: [{ id: "e", jobId: "job-1", name: "Loader", type: "loader", ownership: "owned", dailyRate: 1, usageHours14: Array(14).fill(9), serviceDueDate: "2026-01-07" }],
    });
    const sev = detectAlerts(input).map((a) => a.severity);
    expect(sev).toEqual([...sev].sort((a, b) => ({ critical: 0, warning: 1, info: 2 })[a] - ({ critical: 0, warning: 1, info: 2 })[b]));
    expect(sev[0]).toBe("critical");
    expect(sev[sev.length - 1]).toBe("info");
  });
});
