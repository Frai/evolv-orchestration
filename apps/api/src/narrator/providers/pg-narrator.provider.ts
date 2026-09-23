import { Inject, Injectable } from "@nestjs/common";
import type { Pool } from "pg";
import type { Narrator } from "@evolv/contracts/ports";
import type { Brief, QAPair } from "@evolv/contracts/types";
import { PG_POOL } from "../../db/pg-pool.provider";
import { getLocationById } from "../../locations/location-rows";

interface BriefRow {
  location_id: string;
  date: string;
  headline: string;
  paragraphs: string[];
  delivered_at: string;
  channel: Brief["channel"];
}
const mapBrief = (r: BriefRow): Brief => ({
  locationId: r.location_id,
  date: r.date,
  headline: r.headline,
  paragraphs: r.paragraphs,
  deliveredAt: r.delivered_at,
  channel: r.channel,
});

@Injectable()
export class PgNarrator implements Narrator {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async getBrief(locationId: string, date: string): Promise<Brief | undefined> {
    const { rows } = await this.pool.query<BriefRow>(
      `select location_id, to_char(date, 'YYYY-MM-DD') as date, headline, paragraphs, delivered_at, channel from briefs where location_id = $1 and date = $2`,
      [locationId, date],
    );
    return rows[0] ? mapBrief(rows[0]) : undefined;
  }

  async listBriefs(locationId: string): Promise<Brief[]> {
    const { rows } = await this.pool.query<BriefRow>(
      `select location_id, to_char(date, 'YYYY-MM-DD') as date, headline, paragraphs, delivered_at, channel from briefs where location_id = $1 order by date desc`,
      [locationId],
    );
    return rows.map(mapBrief);
  }

  async suggestedQuestions(locationId: string): Promise<string[]> {
    const { rows } = await this.pool.query<{ question: string }>(`select question from qa_pairs where location_id = $1`, [locationId]);
    return rows.map((r) => r.question);
  }

  async ask(locationId: string, date: string, question: string): Promise<QAPair> {
    const { rows } = await this.pool.query<{ question: string; keywords: string[]; answer: string }>(
      `select question, keywords, answer from qa_pairs where location_id = $1`,
      [locationId],
    );
    const pairs: QAPair[] = rows.map((r) => ({ locationId, question: r.question, keywords: r.keywords, answer: r.answer }));

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

    const location = await getLocationById(this.pool, locationId);
    const name = location?.name ?? "this location";
    return {
      locationId,
      question,
      keywords: [],
      answer: `I can answer questions about ${name}'s sales, labour, stock and menu for ${date}. Try one of: ${pairs
        .slice(0, 3)
        .map((p) => `"${p.question}"`)
        .join(", ")}.`,
    };
  }
}
