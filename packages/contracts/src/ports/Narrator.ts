import type { Brief, QAPair } from "../domain";

export interface Narrator {
  /** The brief for a given business day, or undefined if none was produced. */
  getBrief(companyId: string, date: string): Promise<Brief | undefined>;
  listBriefs(companyId: string): Promise<Brief[]>;
  /** Suggested questions a user can ask about a day. */
  suggestedQuestions(companyId: string): Promise<string[]>;
  ask(companyId: string, date: string, question: string): Promise<QAPair>;
}
