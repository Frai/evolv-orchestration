import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PgNarrator } from "./pg-narrator.provider";

interface QaRow {
  question: string;
  keywords: string[];
  answer: string;
}

function fakePoolForAsk(qaRows: QaRow[], locationRow?: Record<string, unknown>) {
  const query = vi.fn();
  query.mockResolvedValueOnce({ rows: qaRows }); // qa_pairs select
  if (locationRow) {
    query.mockResolvedValueOnce({ rows: [locationRow] }); // locations select
    query.mockResolvedValueOnce({ rows: [] }); // outlets
    query.mockResolvedValueOnce({ rows: [] }); // wage_bands
  } else {
    query.mockResolvedValueOnce({ rows: [] }); // locations select, not found
  }
  return { query } as unknown as Pool;
}

describe("PgNarrator.ask", () => {
  it("picks the QA pair with the highest keyword score", async () => {
    const pool = fakePoolForAsk([
      { question: "How were sales yesterday?", keywords: ["sales", "yesterday"], answer: "Sales answer." },
      { question: "How is labour trending?", keywords: ["labour", "staffing"], answer: "Labour answer." },
    ]);
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("prairie-table", "2026-01-05", "how were sales yesterday");
    expect(result.answer).toBe("Sales answer.");
  });

  it("gives a large bonus to an exact question match", async () => {
    const pool = fakePoolForAsk([
      { question: "Anything unusual?", keywords: ["unusual", "anything"], answer: "Generic match." },
      { question: "What were labour costs?", keywords: [], answer: "Exact match." },
    ]);
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("prairie-table", "2026-01-05", "What were labour costs?");
    expect(result.answer).toBe("Exact match.");
  });

  it("scores a multi-word keyword phrase by substring match", async () => {
    const pool = fakePoolForAsk([{ question: "Dead menu items?", keywords: ["dead item"], answer: "Dead item answer." }]);
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("prairie-table", "2026-01-05", "tell me about any dead item on the menu");
    expect(result.answer).toBe("Dead item answer.");
  });

  it("falls back to a canned answer naming the location and suggested questions when nothing scores", async () => {
    const pool = fakePoolForAsk(
      [{ question: "How were sales?", keywords: ["sales"], answer: "Sales answer." }],
      { id: "prairie-table", name: "Prairie Table", short_name: "Prairie", type: "full_service", pos: "toast", city: "Calgary", currency: "CAD", target_labour_pct: "0.28", menu_item_count: 10, staff_count: 20, kitchen_ticket_capacity_per_hour: 40, owner_name: "Owner", owner_phone: "555", owner_email: "o@example.com" },
    );
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("prairie-table", "2026-01-05", "what is the weather today");
    expect(result.answer).toContain("Prairie Table");
    expect(result.answer).toContain("How were sales?");
    expect(result.keywords).toEqual([]);
  });
});
