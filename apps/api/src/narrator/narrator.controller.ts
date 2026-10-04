import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import type { Narrator } from "@evolv/contracts/ports";
import { NARRATOR } from "./narrator.token";

interface AskBody {
  companyId: string;
  date: string;
  question: string;
}

@Controller("narrator")
export class NarratorController {
  constructor(@Inject(NARRATOR) private readonly narrator: Narrator) {}

  @Get("brief")
  getBrief(@Query("companyId") companyId: string, @Query("date") date: string) {
    return this.narrator.getBrief(companyId, date);
  }

  @Get("briefs")
  listBriefs(@Query("companyId") companyId: string) {
    return this.narrator.listBriefs(companyId);
  }

  @Get("suggested-questions")
  suggestedQuestions(@Query("companyId") companyId: string) {
    return this.narrator.suggestedQuestions(companyId);
  }

  @Post("ask")
  ask(@Body() body: AskBody) {
    return this.narrator.ask(body.companyId, body.date, body.question);
  }
}
