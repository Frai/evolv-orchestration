import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import type { Narrator } from "@evolv/contracts/ports";
import { NARRATOR } from "./narrator.token";

interface AskBody {
  locationId: string;
  date: string;
  question: string;
}

@Controller("narrator")
export class NarratorController {
  constructor(@Inject(NARRATOR) private readonly narrator: Narrator) {}

  @Get("brief")
  getBrief(@Query("locationId") locationId: string, @Query("date") date: string) {
    return this.narrator.getBrief(locationId, date);
  }

  @Get("briefs")
  listBriefs(@Query("locationId") locationId: string) {
    return this.narrator.listBriefs(locationId);
  }

  @Get("suggested-questions")
  suggestedQuestions(@Query("locationId") locationId: string) {
    return this.narrator.suggestedQuestions(locationId);
  }

  @Post("ask")
  ask(@Body() body: AskBody) {
    return this.narrator.ask(body.locationId, body.date, body.question);
  }
}
