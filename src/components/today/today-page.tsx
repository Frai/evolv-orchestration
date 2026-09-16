"use client";
import { MessageCircle } from "lucide-react";
import { adapters } from "@/adapters";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { rangeEndingAt } from "@/core/dates";
import { buildBriefInput } from "@/core/brief";
import { detectAlerts } from "@/core/alerts";
import { int, longDate, money, pct, timeOfDay } from "@/core/format";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/common/stat-tile";
import { Delta } from "@/components/common/delta";
import { Section } from "@/components/common/section";
import { BriefCard } from "./brief-card";
import { AlertsStrip } from "./alerts-strip";
import { AskBox } from "./ask-box";

const POS_LABEL = { toast: "Toast", square: "Square", lightspeed: "Lightspeed" } as const;
const CHANNEL_LABEL = { whatsapp: "WhatsApp", email: "Email", both: "WhatsApp & Email" } as const;

export function TodayPage() {
  const { location, locationId, outletId, asOf, settings } = useAppState();
  const loc = location!;
  const range = rangeEndingAt(asOf, 90);

  const brief = useAsync(() => adapters.narrator.getBrief(locationId, asOf), [locationId, asOf]);
  const delivery = useAsync(() => adapters.notifier.lastDelivery(locationId), [locationId]);
  const numbers = useAsync(async () => {
    const [salesDays, labourDays] = await Promise.all([
      adapters.sales.getSalesDays({ locationId, outletId, range }),
      adapters.labour.getLabourDays({ locationId, outletId, range }),
    ]);
    return { salesDays, labourDays, input: buildBriefInput(loc, asOf, salesDays, labourDays) };
  }, [locationId, outletId, asOf]);

  const alerts = useAsync(async () => {
    const [salesDays, labourDays, stock, itemSales, menu] = await Promise.all([
      adapters.sales.getSalesDays({ locationId, range }),
      adapters.labour.getLabourDays({ locationId, range }),
      adapters.inventory.getStockLevels(locationId),
      adapters.sales.getItemSales({ locationId, range: rangeEndingAt(asOf, 30) }),
      adapters.sales.getMenu(locationId),
    ]);
    return detectAlerts({ location: loc, date: asOf, salesDays, labourDays, stock, itemSales, menu });
  }, [locationId, asOf]);

  const input = numbers.data?.input ?? null;
  const outletName = outletId ? loc.outlets?.find((o) => o.id === outletId)?.name : undefined;
  const channelLabel = CHANNEL_LABEL[settings.deliveryChannel];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Yesterday</div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{longDate(asOf)}</h1>
          <p className="text-muted-foreground text-sm">
            {loc.name}
            {outletName ? ` · ${outletName}` : loc.outlets ? " · All outlets" : ""} · Day closed in {POS_LABEL[loc.pos]}
          </p>
        </div>
        <Badge variant="success" className="w-fit gap-1.5 px-2.5 py-1">
          <MessageCircle className="size-3.5" />
          Sent to {channelLabel} {delivery.data ? timeOfDay(delivery.data.sentAt) : "6:00 a.m."}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Net sales"
          loading={numbers.loading}
          value={input ? money(input.netSales) : "—"}
          delta={<Delta value={input?.netSalesDelta} />}
          hint={input?.netSalesBaseline ? `vs ${input.weekdayName}s` : undefined}
        />
        <StatTile
          label="Labour"
          loading={numbers.loading}
          value={input?.labourPct !== null && input?.labourPct !== undefined ? pct(input.labourPct) : "—"}
          delta={<Delta value={input?.labourPctDelta} kind="pts" goodWhen="down" />}
          hint={`target ${pct(settings.targetLabourPct, 0)}`}
        />
        <StatTile label="Covers" loading={numbers.loading} value={input ? int(input.covers) : "—"} delta={<Delta value={input?.coversDelta} />} hint={input ? `${money(input.avgCheck)} avg check` : undefined} />
        <StatTile
          label={loc.type === "hotel" ? "Room service share" : "Delivery share"}
          loading={numbers.loading}
          value={input ? pct(input.deliveryShare, 0) : "—"}
          delta={<Delta value={input?.deliveryShareDelta} kind="pts" />}
          hint={input ? money(input.channels.delivery + input.channels.room_service) : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <BriefCard brief={brief.data} loading={brief.loading} />
          <AskBox locationId={locationId} date={asOf} />
        </div>
        <Section title="Alerts" description="Rules run over the closed day. Tap one to see the source.">
          <AlertsStrip alerts={alerts.data} loading={alerts.loading} />
        </Section>
      </div>
    </div>
  );
}
