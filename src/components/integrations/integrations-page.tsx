"use client";
import { useState } from "react";
import { Check, Clock, Plug } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import type { Integration, IntegrationArea } from "@/core/types";
import { timeOfDay } from "@/core/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectDialog } from "./connect-dialog";
import { cn } from "@/lib/utils";

const AREAS: { id: IntegrationArea; label: string; blurb: string }[] = [
  { id: "pos", label: "Point of sale", blurb: "Where sales, items and hours come from." },
  { id: "scheduling", label: "Scheduling", blurb: "Scheduled vs actual hours and wage bands." },
  { id: "inventory", label: "Inventory", blurb: "Counts, par levels and supplier orders." },
  { id: "accounting", label: "Accounting", blurb: "P&L and cash for Finance Insights." },
  { id: "delivery", label: "Delivery", blurb: "Order volume and commissions by platform." },
  { id: "reservations", label: "Reservations", blurb: "Covers booked, no-shows and guest notes." },
  { id: "messaging", label: "Messaging", blurb: "Where the morning brief and alerts go." },
];

export function IntegrationsPage() {
  const { integrations, integrationsLoading, location, connectIntegration } = useAppState();
  const [connecting, setConnecting] = useState<Integration | null>(null);
  const connected = integrations.filter((i) => i.state === "connected").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Integrations" description={`${connected} connected at ${location?.name}. Connecting takes about a minute and never needs a developer.`} />
      {integrationsLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        AREAS.map((area) => {
          const items = integrations.filter((i) => i.area === area.id);
          if (!items.length) return null;
          return (
            <section key={area.id} className="flex flex-col gap-2.5">
              <div>
                <h2 className="font-semibold">{area.label}</h2>
                <p className="text-muted-foreground text-xs">{area.blurb}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((i) => (
                  <IntegrationCard key={i.id} integration={i} onConnect={() => setConnecting(i)} />
                ))}
              </div>
            </section>
          );
        })
      )}
      <ConnectDialog
        integration={connecting}
        onClose={() => setConnecting(null)}
        onConnected={(id) => connectIntegration(id)}
      />
    </div>
  );
}

function VendorMark({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return <span className="bg-muted text-muted-foreground grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold">{initials}</span>;
}

function IntegrationCard({ integration: i, onConnect }: { integration: Integration; onConnect: () => void }) {
  const coming = i.state === "coming_soon";
  return (
    <Card className={cn("gap-3 px-4 py-4", coming && "bg-muted/40")}>
      <div className="flex items-start gap-3">
        <VendorMark name={i.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("truncate font-medium", coming && "text-muted-foreground")}>{i.name}</span>
          </div>
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{i.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        {i.state === "connected" ? (
          <Badge variant="success" className="gap-1">
            <Check /> Connected
          </Badge>
        ) : coming ? (
          <Badge variant="muted" className="gap-1">
            <Clock /> Coming soon
          </Badge>
        ) : (
          <Badge variant="outline">Available</Badge>
        )}
        {i.state === "connected" ? (
          <span className="text-muted-foreground text-xs">Last sync {i.lastSyncAt ? timeOfDay(i.lastSyncAt) : "—"}</span>
        ) : coming ? (
          <Button size="sm" variant="ghost" disabled>
            Notify me
          </Button>
        ) : (
          <Button size="sm" onClick={onConnect}>
            <Plug /> Connect
          </Button>
        )}
      </div>
    </Card>
  );
}
