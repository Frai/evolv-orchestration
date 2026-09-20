import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import type { Notifier } from "@evolv/contracts/ports";
import type { DeliveryChannel } from "@evolv/contracts/types";
import { NOTIFIER } from "./notifier.token";

interface SendBody {
  channel: DeliveryChannel;
  to: string[];
  subject: string;
  body: string;
}

@Controller("notifier")
export class NotifierController {
  constructor(@Inject(NOTIFIER) private readonly notifier: Notifier) {}

  @Post("send")
  send(@Body() body: SendBody) {
    return this.notifier.send(body.channel, body.to, body.subject, body.body);
  }

  @Get("last-delivery")
  lastDelivery(@Query("locationId") locationId: string) {
    return this.notifier.lastDelivery(locationId);
  }
}
