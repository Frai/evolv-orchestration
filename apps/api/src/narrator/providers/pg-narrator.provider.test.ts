import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { PgNarrator } from "./pg-narrator.provider";

interface QaRow {
  question: string;
  keywords: string[];
  answer: string;
}

function fakePoolForAsk(qaRows: QaRow[], companyRow?: { name: string }) {
  const query = vi.fn();
  query.mockResolvedValueOnce({ rows: qaRows }); // qa_pairs select
  query.mockResolvedValueOnce({ rows: companyRow ? [companyRow] : [] }); // companies select
  return { query } as unknown as Pool;
}

describe("PgNarrator.ask", () => {
  it("picks the QA pair with the highest keyword score", async () => {
    const pool = fakePoolForAsk([
      { question: "Which jobs are at margin risk?", keywords: ["margin", "risk"], answer: "Margin answer." },
      { question: "Where is overtime coming from?", keywords: ["overtime", "hours"], answer: "Overtime answer." },
    ]);
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("foothills-pipeline", "2026-01-05", "which jobs have margin risk");
    expect(result.answer).toBe("Margin answer.");
  });

  it("gives a large bonus to an exact question match", async () => {
    const pool = fakePoolForAsk([
      { question: "Anything unusual?", keywords: ["unusual", "anything"], answer: "Generic match." },
      { question: "What is our billing status?", keywords: [], answer: "Exact match." },
    ]);
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("foothills-pipeline", "2026-01-05", "What is our billing status?");
    expect(result.answer).toBe("Exact match.");
  });

  it("scores a multi-word keyword phrase by substring match", async () => {
    const pool = fakePoolForAsk([{ question: "Missing change orders?", keywords: ["change order"], answer: "Change order answer." }]);
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("foothills-pipeline", "2026-01-05", "are there any change order gaps on the Ridge Loop job");
    expect(result.answer).toBe("Change order answer.");
  });

  it("falls back to a canned answer naming the company and suggested questions when nothing scores", async () => {
    const pool = fakePoolForAsk(
      [{ question: "Which jobs are at margin risk?", keywords: ["margin"], answer: "Margin answer." }],
      { name: "Foothills Pipeline & Civil" },
    );
    const narrator = new PgNarrator(pool);
    const result = await narrator.ask("foothills-pipeline", "2026-01-05", "what is the weather today");
    expect(result.answer).toContain("Foothills Pipeline & Civil");
    expect(result.answer).toContain("Which jobs are at margin risk?");
    expect(result.keywords).toEqual([]);
  });
});
