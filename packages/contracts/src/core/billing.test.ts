import { describe, expect, it } from "vitest";
import type { ChangeOrder, FieldTicket, Invoice } from "../domain";
import { billingLag, missingChangeOrders, receivables, ticketLeakage, ticketPipeline } from "./billing";
import { jobEvm } from "./evm";
import { JOB, code, day } from "./test-helpers";

const ticket = (over: Partial<FieldTicket> = {}): FieldTicket => ({
  id: "t1",
  companyId: "foothills",
  jobId: "job-1",
  number: "FT-1",
  date: "2026-01-10",
  crew: "Crew 1",
  description: "Vac truck",
  labourHours: 10,
  equipmentHours: 10,
  amount: 5_000,
  status: "open",
  ...over,
});

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1",
  jobId: "job-1",
  number: "INV-1",
  periodEnd: "2026-01-05",
  amount: 100_000,
  status: "issued",
  ...over,
});

describe("ticketLeakage", () => {
  const asOf = "2026-01-20";
  it("flags unsigned tickets only after the grace period", () => {
    const l = ticketLeakage([ticket({ date: "2026-01-19" }), ticket({ id: "t2", date: "2026-01-16" })], asOf);
    expect(l.unsigned.map((t) => t.id)).toEqual(["t2"]);
    expect(l.atRisk).toBe(5_000);
  });
  it("flags signed tickets that never reached the client's billing system", () => {
    const l = ticketLeakage([ticket({ status: "signed", date: "2026-01-12" })], asOf);
    expect(l.unsubmitted).toHaveLength(1);
  });
  it("always flags disputed tickets and never flags paid ones", () => {
    const l = ticketLeakage([ticket({ status: "disputed" }), ticket({ id: "t2", status: "paid", date: "2025-12-01" })], asOf);
    expect(l.disputed).toHaveLength(1);
    expect(l.atRisk).toBe(5_000);
  });
});

describe("ticketPipeline", () => {
  it("totals count and dollars per status", () => {
    const p = ticketPipeline([ticket(), ticket({ id: "t2", amount: 1_000 }), ticket({ id: "t3", status: "paid" })]);
    expect(p.find((r) => r.status === "open")).toMatchObject({ count: 2, amount: 6_000 });
    expect(p.find((r) => r.status === "paid")?.count).toBe(1);
  });
});

describe("billingLag", () => {
  it("is earned revenue less issued invoices; drafts do not count as billed", () => {
    const evm = jobEvm(JOB, [code()], [day({ qty: 50, cost: 40_000 })], "2026-01-05"); // 50% complete
    const lag = billingLag(JOB, evm, [invoice({ amount: 300_000 }), invoice({ id: "i2", status: "draft", amount: 99_000 })]);
    expect(lag.earned).toBe(500_000);
    expect(lag.billed).toBe(300_000);
    expect(lag.lag).toBe(200_000);
    expect(lag.lagPct).toBeCloseTo(0.4);
  });
  it("never goes negative when billed ahead of progress", () => {
    const evm = jobEvm(JOB, [code()], [day({ qty: 10, cost: 5_000 })], "2026-01-05");
    expect(billingLag(JOB, evm, [invoice({ amount: 900_000 })]).lag).toBe(0);
  });
});

describe("receivables", () => {
  it("separates outstanding from overdue", () => {
    const r = receivables([invoice({ dueDate: "2026-01-01" }), invoice({ id: "i2", dueDate: "2026-02-01", amount: 50_000 }), invoice({ id: "i3", status: "paid" })], "2026-01-15");
    expect(r.outstanding).toBe(150_000);
    expect(r.overdue).toBe(100_000);
    expect(r.overdueCount).toBe(1);
  });
});

describe("missingChangeOrders", () => {
  const extra = code({ id: "x", code: "99-100", name: "Rock excavation", budget: 0, plannedQty: 0, extra: true });
  const days = [day({ codeId: "x", date: "2026-01-04", hours: 40, cost: 10_000 }), day({ codeId: "x", date: "2026-01-06", hours: 60, cost: 15_000 })];
  const co = (over: Partial<ChangeOrder> = {}): ChangeOrder => ({ id: "co1", jobId: "job-1", number: "CO-1", title: "x", amount: 1, status: "pending", codeId: "x", createdAt: "2026-01-07", ...over });

  it("reports cost booked to extra-work codes with no change order", () => {
    const m = missingChangeOrders([code(), extra], days, [], "2026-01-10");
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ code: "99-100", hours: 100, cost: 25_000, firstDate: "2026-01-04", lastDate: "2026-01-06" });
  });
  it("is covered by a pending or approved change order", () => {
    expect(missingChangeOrders([extra], days, [co()], "2026-01-10")).toHaveLength(0);
    expect(missingChangeOrders([extra], days, [co({ status: "approved" })], "2026-01-10")).toHaveLength(0);
  });
  it("is not covered by a rejected change order", () => {
    expect(missingChangeOrders([extra], days, [co({ status: "rejected" })], "2026-01-10")).toHaveLength(1);
  });
  it("ignores regular estimated codes", () => {
    expect(missingChangeOrders([code()], [day({ cost: 5_000 })], [], "2026-01-10")).toHaveLength(0);
  });
});
