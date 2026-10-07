// Shared builders for unit tests. Excluded from the published build.
import type { Company, CostCode, CostDay, Job } from "../domain";

export const COMPANY: Company = {
  id: "foothills",
  name: "Foothills Pipeline & Civil",
  shortName: "Foothills",
  segment: "pipeline_civil",
  accounting: "vista",
  city: "Calgary, AB",
  currency: "CAD",
  employeeCount: 100,
  targetMarginPct: 0.12,
  owner: { name: "Owner", role: "Controller", phone: "555", email: "owner@example.com" },
};

export const JOB: Job = {
  id: "job-1",
  companyId: "foothills",
  name: "Ridge Loop",
  client: "Summit Creek Energy",
  contractValue: 1_000_000,
  startDate: "2026-01-01",
  endDate: "2026-01-10",
  status: "active",
  pm: "PM",
};

export function code(over: Partial<CostCode> = {}): CostCode {
  return {
    id: "c1",
    jobId: "job-1",
    code: "02-100",
    name: "Trenching",
    category: "labour",
    budget: 100_000,
    plannedQty: 100,
    unit: "m",
    plannedStart: "2026-01-01",
    plannedEnd: "2026-01-10",
    ...over,
  };
}

export function day(over: Partial<CostDay> = {}): CostDay {
  return { jobId: "job-1", codeId: "c1", date: "2026-01-01", hours: 0, overtimeHours: 0, cost: 0, qty: 0, ...over };
}
