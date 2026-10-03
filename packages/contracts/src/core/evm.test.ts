import { describe, expect, it } from "vitest";
import { codeEvm, evmSeries, jobEvm, plannedPercent, portfolioMargin, trailingCpi } from "./evm";
import { JOB, code, day } from "./test-helpers";

describe("plannedPercent", () => {
  const c = code(); // 10-day window
  it("is zero before the planned start", () => {
    expect(plannedPercent(c, "2025-12-31")).toBe(0);
  });
  it("counts the start day as one tenth", () => {
    expect(plannedPercent(c, "2026-01-01")).toBeCloseTo(0.1);
  });
  it("is linear to the midpoint and caps at 100%", () => {
    expect(plannedPercent(c, "2026-01-05")).toBeCloseTo(0.5);
    expect(plannedPercent(c, "2026-02-01")).toBe(1);
  });
});

describe("codeEvm", () => {
  it("computes EV, AC, CPI and SPI from quantity and cost", () => {
    // 50 of 100 m installed (EV 50k) for 62.5k spent on day 5 (PV 50k).
    const e = codeEvm(code(), [day({ date: "2026-01-03", qty: 50, cost: 62_500 })], "2026-01-05");
    expect(e.ev).toBe(50_000);
    expect(e.ac).toBe(62_500);
    expect(e.pv).toBeCloseTo(50_000);
    expect(e.cpi).toBeCloseTo(0.8);
    expect(e.spi).toBeCloseTo(1);
  });

  it("forecasts EAC with the typical-divergence formula", () => {
    const e = codeEvm(code(), [day({ qty: 50, cost: 62_500 })], "2026-01-05");
    // AC + (BAC - EV) / CPI = 62.5k + 50k / 0.8 = 125k
    expect(e.eac).toBeCloseTo(125_000);
    expect(e.vac).toBeCloseTo(-25_000);
  });

  it("ignores days after the as-of date", () => {
    const e = codeEvm(code(), [day({ date: "2026-01-09", qty: 100, cost: 90_000 })], "2026-01-05");
    expect(e.ac).toBe(0);
    expect(e.ev).toBe(0);
  });

  it("has no CPI before anything is earned and falls back to the budget", () => {
    const e = codeEvm(code(), [], "2026-01-03");
    expect(e.cpi).toBeNull();
    expect(e.eac).toBe(100_000);
  });

  it("treats extra work as pure overrun: no budget, no earned value", () => {
    const extra = code({ id: "x", budget: 0, plannedQty: 0, extra: true });
    const e = codeEvm(extra, [day({ codeId: "x", cost: 30_000, hours: 300 })], "2026-01-05");
    expect(e.ev).toBe(0);
    expect(e.eac).toBe(30_000);
    expect(e.vac).toBe(-30_000);
  });
});

describe("jobEvm", () => {
  const codes = [code(), code({ id: "c2", code: "02-200", budget: 200_000, plannedQty: 200 })];

  it("rolls codes up and computes margin at completion", () => {
    const days = [day({ qty: 50, cost: 50_000 }), day({ codeId: "c2", qty: 100, cost: 130_000 })];
    const e = jobEvm(JOB, codes, days, "2026-01-05");
    expect(e.bac).toBe(300_000);
    expect(e.ev).toBe(150_000);
    expect(e.ac).toBe(180_000);
    expect(e.cpi).toBeCloseTo(150 / 180);
    // EAC = 180k + 150k / (150/180) = 360k; margin on a $1M contract = 64%.
    expect(e.eac).toBeCloseTo(360_000);
    expect(e.marginAtCompletion).toBeCloseTo(0.64);
    expect(e.budgetMargin).toBeCloseTo(0.7);
  });

  it("only counts the requested job", () => {
    const e = jobEvm(JOB, [...codes, code({ id: "other", jobId: "job-2" })], [day({ jobId: "job-2", codeId: "other", cost: 9 })], "2026-01-05");
    expect(e.codes).toHaveLength(2);
    expect(e.ac).toBe(0);
  });
});

describe("evmSeries", () => {
  it("accumulates cost and earned value day by day", () => {
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];
    const s = evmSeries(JOB, [code()], [day({ date: "2026-01-01", qty: 10, cost: 8_000 }), day({ date: "2026-01-03", qty: 10, cost: 9_000 })], dates);
    expect(s.map((p) => p.ac)).toEqual([8_000, 8_000, 17_000]);
    expect(s.map((p) => Math.round(p.ev))).toEqual([10_000, 10_000, 20_000]);
    expect(s[2].pv).toBeCloseTo(30_000);
  });
});

describe("trailingCpi", () => {
  it("looks only at the trailing window", () => {
    const days = [
      day({ date: "2026-01-02", qty: 10, cost: 5_000 }), // early, efficient
      day({ date: "2026-01-08", qty: 10, cost: 20_000 }), // recent, inefficient
    ];
    const t = trailingCpi(JOB, [code()], days, "2026-01-10", 5);
    expect(t).toBeCloseTo(10_000 / 20_000);
  });
  it("is null when nothing happened in the window", () => {
    expect(trailingCpi(JOB, [code()], [day({ date: "2026-01-02", qty: 10, cost: 5_000 })], "2026-01-10", 3)).toBeNull();
  });
});

describe("portfolioMargin", () => {
  it("weights by contract value", () => {
    const j2 = { ...JOB, id: "job-2", contractValue: 3_000_000 };
    const evm = (jobId: string, eac: number) => ({ jobId, eac }) as never;
    const p = portfolioMargin([JOB, j2], [evm("job-1", 900_000), evm("job-2", 2_700_000)]);
    expect(p.contractValue).toBe(4_000_000);
    expect(p.marginAtCompletion).toBeCloseTo(0.1);
    expect(p.marginDollars).toBe(400_000);
  });
});
