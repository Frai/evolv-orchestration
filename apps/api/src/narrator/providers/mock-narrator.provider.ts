import { Injectable } from "@nestjs/common";
import type { Narrator } from "@evolv/contracts/ports";
import type { Brief, QAPair } from "@evolv/contracts/types";
import { FixturesService, latency } from "../../fixtures/fixtures.service";

/** Reads pre-written briefs and answers questions from a small per-location lookup. No model is called. */
@Injectable()
export class MockNarrator implements Narrator {
  constructor(private readonly fixtures: FixturesService) {}

  async getBrief(locationId: string, date: string): Promise<Brief | undefined> {
    return latency(this.fixtures.briefs.find((b) => b.locationId === locationId && b.date === date), 160);
  }
  async listBriefs(locationId: string): Promise<Brief[]> {
    return latency(this.fixtures.briefs.filter((b) => b.locationId === locationId).sort((a, b) => b.date.localeCompare(a.date)));
  }
  async suggestedQuestions(locationId: string): Promise<string[]> {
    return latency(this.fixtures.qa.filter((q) => q.locationId === locationId).map((q) => q.question), 10);
  }
  async ask(locationId: string, date: string, question: string): Promise<QAPair> {
    const pairs = this.fixtures.qa.filter((q) => q.locationId === locationId);
    const words = question
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    let best: { pair: QAPair; score: number } | null = null;
    for (const pair of pairs) {
      let score = 0;
      for (const k of pair.keywords) {
        const kw = k.toLowerCase();
        if (kw.includes(" ")) {
          if (question.toLowerCase().includes(kw)) score += 2;
        } else if (words.includes(kw)) score += 1;
      }
      if (question.trim().toLowerCase() === pair.question.toLowerCase()) score += 10;
      if (!best || score > best.score) best = { pair, score };
    }
    if (best && best.score > 0) return latency(best.pair, 700);
    const name = this.fixtures.locations.find((l) => l.id === locationId)?.name ?? "this location";
    return latency(
      {
        locationId,
        question,
        keywords: [],
        answer: `I can answer questions about ${name}'s sales, labour, stock and menu for ${date}. Try one of: ${pairs
          .slice(0, 3)
          .map((p) => `"${p.question}"`)
          .join(", ")}.`,
      },
      600,
    );
  }
}
