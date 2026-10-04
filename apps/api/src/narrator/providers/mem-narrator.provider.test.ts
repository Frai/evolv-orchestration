import { describe, expect, it } from "vitest";
import type { QAPair } from "@evolv/contracts/types";
import type { StoreService } from "../../store/store.service";
import { MemNarrator } from "./mem-narrator.provider";

const qa = (question: string, keywords: string[], answer: string): QAPair => ({ companyId: "foothills-pipeline", question, keywords, answer });

function narrator(pairs: QAPair[]) {
  const store = { fx: { qa: pairs, briefs: [], companies: [{ id: "foothills-pipeline", name: "Foothills Pipeline & Civil" }] } } as unknown as StoreService;
  return new MemNarrator(store);
}

describe("MemNarrator.ask", () => {
  it("picks the QA pair with the highest keyword score", async () => {
    const n = narrator([qa("Which jobs are at margin risk?", ["margin", "risk"], "Margin answer."), qa("Where is overtime coming from?", ["overtime", "hours"], "Overtime answer.")]);
    expect((await n.ask("foothills-pipeline", "2026-10-02", "which jobs have margin risk")).answer).toBe("Margin answer.");
  });

  it("gives a large bonus to an exact question match", async () => {
    const n = narrator([qa("Anything unusual?", ["unusual", "anything"], "Generic match."), qa("What is our billing status?", [], "Exact match.")]);
    expect((await n.ask("foothills-pipeline", "2026-10-02", "What is our billing status?")).answer).toBe("Exact match.");
  });

  it("scores a multi-word keyword phrase by substring match", async () => {
    const n = narrator([qa("Missing change orders?", ["change order"], "Change order answer.")]);
    expect((await n.ask("foothills-pipeline", "2026-10-02", "are there any change order gaps on Ridge Loop")).answer).toBe("Change order answer.");
  });

  it("falls back to a canned answer naming the company and suggested questions when nothing scores", async () => {
    const n = narrator([qa("Which jobs are at margin risk?", ["margin"], "Margin answer.")]);
    const r = await n.ask("foothills-pipeline", "2026-10-02", "what is the weather today");
    expect(r.answer).toContain("Foothills Pipeline & Civil");
    expect(r.answer).toContain("Which jobs are at margin risk?");
    expect(r.keywords).toEqual([]);
  });
});
