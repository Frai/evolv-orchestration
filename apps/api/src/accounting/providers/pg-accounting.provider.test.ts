import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PgAccountingSource } from "./pg-accounting.provider";

function fakePool(salesRow: { total: string | null; days: string }, labourRow: { total: string | null }) {
  const query = vi.fn().mockResolvedValueOnce({ rows: [salesRow] }).mockResolvedValueOnce({ rows: [labourRow] });
  return { query } as unknown as Pool;
}

describe("PgAccountingSource.getCostSummary", () => {
  it("derives cogs as a fixed 31% of net sales", async () => {
    const pool = fakePool({ total: "10000", days: "10" }, { total: "2000" });
    const source = new PgAccountingSource(pool);
    const summary = await source.getCostSummary("prairie-table", { from: "2026-01-01", to: "2026-01-10" });

    expect(summary.netSales).toBe(10000);
    expect(summary.cogs).toBe(3100); // 31% of 10000
    expect(summary.labour).toBe(2000);
  });

  it("derives fixed cost from the day count at a $9,800/30-day rate", async () => {
    const pool = fakePool({ total: "5000", days: "15" }, { total: "1000" });
    const source = new PgAccountingSource(pool);
    const summary = await source.getCostSummary("prairie-table", { from: "2026-01-01", to: "2026-01-15" });

    expect(summary.fixed).toBe(Math.round((15 / 30) * 9800));
  });

  it("handles no rows (zero activity in range) without throwing", async () => {
    const pool = fakePool({ total: null, days: "0" }, { total: null });
    const source = new PgAccountingSource(pool);
    const summary = await source.getCostSummary("prairie-table", { from: "2026-01-01", to: "2026-01-01" });

    expect(summary.netSales).toBe(0);
    expect(summary.cogs).toBe(0);
    expect(summary.labour).toBe(0);
    expect(summary.fixed).toBe(0);
  });
});
