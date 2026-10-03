import { describe, expect, it } from "vitest";
import { buildBriefInput, type BriefData } from "./brief";
import { COMPANY, JOB, code, day } from "./test-helpers";

function data(over: Partial<BriefData> = {}): BriefData {
  return {
    company: COMPANY,
    date: "2026-01-10",
    jobs: [JOB],
    codes: [code()],
    costDays: [
      day({ date: "2026-01-02", qty: 30, cost: 25_000, hours: 100, overtimeHours: 5 }),
      day({ date: "2026-01-09", qty: 30, cost: 45_000, hours: 100, overtimeHours: 30 }),
    ],
    tickets: [],
    invoices: [],
    changeOrders: [],
    alerts: [],
    ...over,
  };
}

describe("buildBriefInput", () => {
  it("returns null when the company has no jobs", () => {
    expect(buildBriefInput(data({ jobs: [] }))).toBeNull();
  });

  it("computes the portfolio forecast margin and its change versus a week earlier", () => {
    const b = buildBriefInput(data())!;
    expect(b.weekdayName).toBe("Saturday");
    expect(b.marginAtCompletion).toBeLessThan(b.marginPrev ?? 0);
    expect(b.marginDelta).toBeCloseTo(b.marginAtCompletion - (b.marginPrev ?? 0));
  });

  it("has no week-over-week comparison when nothing had been spent a week ago", () => {
    const b = buildBriefInput(data({ costDays: [day({ date: "2026-01-09", qty: 30, cost: 45_000 })] }))!;
    expect(b.marginPrev).toBeNull();
    expect(b.marginDelta).toBeNull();
  });

  it("picks the job with the lowest forecast margin as the worst", () => {
    const j2 = { ...JOB, id: "job-2", name: "Second", contractValue: 400_000 };
    const c2 = code({ id: "c2", jobId: "job-2" });
    const b = buildBriefInput(data({ jobs: [JOB, j2], codes: [code(), c2], costDays: [day({ qty: 50, cost: 40_000 }), day({ jobId: "job-2", codeId: "c2", qty: 50, cost: 90_000 })] }))!;
    expect(b.worstJob?.jobId).toBe("job-2");
  });

  it("rolls up unbilled work, change-order exposure and overtime", () => {
    const extra = code({ id: "x", budget: 0, plannedQty: 0, extra: true });
    const b = buildBriefInput(data({ codes: [code(), extra], costDays: [...data().costDays, day({ codeId: "x", date: "2026-01-08", cost: 12_000, hours: 40 })] }))!;
    expect(b.unbilledWork).toBeGreaterThan(0);
    expect(b.missingChangeOrderCost).toBe(12_000);
    expect(b.overtimePct).toBeCloseTo(30 / 140); // the extra-work hours count in the denominator
  });

  it("counts alerts by severity", () => {
    const alert = (severity: "critical" | "warning" | "info") => ({ severity }) as never;
    const b = buildBriefInput(data({ alerts: [alert("critical"), alert("warning"), alert("warning"), alert("info")] }))!;
    expect(b.criticalAlerts).toBe(1);
    expect(b.warningAlerts).toBe(2);
  });
});
