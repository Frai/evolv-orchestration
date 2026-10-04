import { Injectable } from "@nestjs/common";
import type { Narrator } from "@evolv/contracts/ports";
import type { Brief, QAPair } from "@evolv/contracts/types";
import { StoreService } from "../../store/store.service";

@Injectable()
export class MemNarrator implements Narrator {
  constructor(private readonly store: StoreService) {}

  async getBrief(companyId: string, date: string): Promise<Brief | undefined> {
    return this.store.fx.briefs.find((b) => b.companyId === companyId && b.date === date);
  }

  async listBriefs(companyId: string): Promise<Brief[]> {
    return this.store.fx.briefs.filter((b) => b.companyId === companyId).sort((a, b) => b.date.localeCompare(a.date));
  }

  async suggestedQuestions(companyId: string): Promise<string[]> {
    return this.store.fx.qa.filter((q) => q.companyId === companyId).map((q) => q.question);
  }

  async ask(companyId: string, date: string, question: string): Promise<QAPair> {
    const pairs = this.store.fx.qa.filter((q) => q.companyId === companyId);

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
    if (best && best.score > 0) return best.pair;

    const name = this.store.fx.companies.find((c) => c.id === companyId)?.name ?? "this company";
    return {
      companyId,
      question,
      keywords: [],
      answer: `I can answer questions about ${name}'s margin, cost codes, billing, labour and materials for ${date}. Try one of: ${pairs
        .slice(0, 3)
        .map((p) => `"${p.question}"`)
        .join(", ")}.`,
    };
  }
}
