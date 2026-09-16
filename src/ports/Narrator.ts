import type { Brief, QAPair } from "@/core/types";

export interface Narrator {
  /** The brief for a given business day, or undefined if none was produced. */
  getBrief(locationId: string, date: string): Promise<Brief | undefined>;
  listBriefs(locationId: string): Promise<Brief[]>;
  /** Suggested questions a user can ask about a day. */
  suggestedQuestions(locationId: string): Promise<string[]>;
  ask(locationId: string, date: string, question: string): Promise<QAPair>;
}
