import { describe, expect, it } from "vitest";
import type { Commitment, Equipment, SafetyEvent } from "../domain";
import { avgUtilization, daysOverdue, idleBurn, idleDays, materialSlipDays, materialsAtRisk, overdueSafety, serviceDueInDays } from "./resources";

const unit = (usage: number[], over: Partial<Equipment> = {}): Equipment => ({
  id: "e1",
  jobId: "job-1",
  name: "Excavator",
  type: "excavator",
  ownership: "rented",
  dailyRate: 1_200,
  usageHours14: usage,
  ...over,
});

describe("equipment", () => {
  const usage = [8, 9, 10, 8, 9, 0, 0, 8, 9, 0, 0, 0, 0, 0];
  it("counts idle days in the trailing week", () => {
    expect(idleDays(unit(usage), 7)).toBe(5);
  });
  it("prices the idle days at the daily rate", () => {
    expect(idleBurn(unit(usage), 7)).toBe(6_000);
  });
  it("computes utilization against a ten-hour day, capped at 100%", () => {
    expect(avgUtilization(unit(Array(14).fill(10)))).toBe(1);
    expect(avgUtilization(unit(Array(14).fill(5)))).toBeCloseTo(0.5);
    expect(avgUtilization(unit([]))).toBe(0);
  });
  it("reports days until service", () => {
    expect(serviceDueInDays(unit(usage, { serviceDueDate: "2026-01-15" }), "2026-01-10")).toBe(5);
    expect(serviceDueInDays(unit(usage), "2026-01-10")).toBeNull();
  });
});

describe("materials", () => {
  const po = (over: Partial<Commitment> = {}): Commitment => ({
    id: "p1",
    jobId: "job-1",
    vendor: "Vendor",
    description: "NPS 12 pipe",
    kind: "po",
    committed: 100_000,
    invoiced: 0,
    promisedDate: "2026-02-10",
    needDate: "2026-02-01",
    status: "open",
    ...over,
  });
  it("measures slip as promised date minus need date", () => {
    expect(materialSlipDays(po())).toBe(9);
    expect(materialSlipDays(po({ promisedDate: "2026-01-28" }))).toBe(-4);
  });
  it("flags only open commitments landing after the need date, worst first", () => {
    const risky = materialsAtRisk([po({ id: "a", promisedDate: "2026-02-03" }), po({ id: "b" }), po({ id: "c", status: "delivered" }), po({ id: "d", promisedDate: "2026-01-30" })]);
    expect(risky.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("safety", () => {
  const ev = (over: Partial<SafetyEvent> = {}): SafetyEvent => ({
    id: "s1",
    jobId: "job-1",
    kind: "inspection_finding",
    date: "2026-01-01",
    title: "Guarding missing",
    owner: "Superintendent",
    correctiveDue: "2026-01-08",
    status: "open",
    ...over,
  });
  it("returns open actions past their due date, oldest first", () => {
    const r = overdueSafety([ev({ id: "a", correctiveDue: "2026-01-09" }), ev({ id: "b" }), ev({ id: "c", status: "closed" }), ev({ id: "d", correctiveDue: "2026-01-20" })], "2026-01-12");
    expect(r.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("counts days overdue", () => {
    expect(daysOverdue(ev(), "2026-01-12")).toBe(4);
  });
});
