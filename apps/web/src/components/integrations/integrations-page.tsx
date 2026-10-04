"use client";
import { useState } from "react";
import { Check, Clock, Plug } from "lucide-react";
import { useAppState } from "@/components/providers/app-state";
import type { Integration, IntegrationArea } from "@evolv/contracts/types";
import { timeOfDay } from "@evolv/contracts/format";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectDialog } from "./connect-dialog";
import { cn } from "@/lib/utils";

const AREAS: { id: IntegrationArea; label: string; blurb: string }[] = [
  { id: "accounting", label: "Accounting", blurb: "Job cost, commitments, receivables and payroll." },
  { id: "estimating", label: "Estimating and spreadsheets", blurb: "Budget at completion per cost code. A spreadsheet drop is a first-class source." },
  { id: "timekeeping", label: "Timekeeping", blurb: "Crew hours by worker, cost code and day." },
  { id: "field", label: "Field progress and schedule", blurb: "Quantities installed, daily reports and the look-ahead." },
  { id: "ticketing", label: "Field ticketing", blurb: "Electronic field tickets with client signatures." },
  { id: "billing", label: "Client billing network", blurb: "Invoice status and dispute reasons from the operator's side." },
  { id: "equipment", label: "Equipment and telematics", blurb: "Utilization, idle time and maintenance." },
  { id: "safety", label: "Safety", blurb: "Incidents, inspections and corrective actions." },
  { id: "messaging", label: "Messaging", blurb: "Where the daily brief and urgent alerts go." },
];

export function IntegrationsPage() {
  const { integrations, integrationsLoading, company, connectIntegration } = useAppState();
  const [connecting, setConnecting] = useState<Integration | null>(null);
  const connected = integrations.filter((i) => i.state === "connected").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Integrations" description={`${connected} connected at ${company?.name}. Evolv starts read-only: it reads exports, files or APIs and never changes your accounting setup.`} />
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
