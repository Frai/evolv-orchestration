"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, ClipboardList } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { daysOfCover, reorderCost, reorderQty, sortByUrgency, stockStatus } from "@evolv/contracts/inventory";
import { money, one, dateTime } from "@evolv/contracts/format";
import type { Approval, StockLevel, StockStatus } from "@evolv/contracts/types";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { StatTile } from "@/components/common/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const STATUS: Record<StockStatus, { label: string; variant: "danger" | "warning" | "info" | "success" }> = {
  critical: { label: "Critical", variant: "danger" },
  below_par: { label: "Below par", variant: "warning" },
  low: { label: "Low", variant: "info" },
  ok: { label: "OK", variant: "success" },
};

export function InventoryPage() {
  const { locationId, location, approvals, addApproval } = useAppState();
  const stock = useAsync(() => apiClient.inventory.getStockLevels(locationId), [locationId]);
  const [drafted, setDrafted] = useState<Record<string, string>>({});

  const rows = stock.data ? sortByUrgency(stock.data) : [];
  const flagged = rows.filter((r) => ["critical", "below_par"].includes(stockStatus(r)));
  const rest = rows.filter((r) => !flagged.includes(r));
  const value = rows.reduce((a, r) => a + r.onHand * r.unitCost, 0);
  const counted = rows[0]?.countedAt;

  const existingApprovalFor = (s: StockLevel) =>
    approvals.find((a) => a.agentId === "inventory-guard" && a.status === "pending" && a.title.toLowerCase().includes(s.name.toLowerCase()));

  const draft = (s: StockLevel) => {
    const q = reorderQty(s);
    const cost = reorderCost(s);
    const a: Approval = {
      id: `${locationId}-reorder-${s.itemId}`,
      locationId,
      agentId: "inventory-guard",
      title: `Reorder ${q} ${s.unit} ${s.name.toLowerCase()} from ${s.supplier} (${money(cost)})`,
      summary: `${s.name} is at ${s.onHand} ${s.unit} against a par of ${s.par}, ${one(daysOfCover(s))} days of cover at ${s.dailyUsage} ${s.unit}/day.`,
      amount: cost,
      evidence: [
        { label: "On hand", value: `${s.onHand} ${s.unit}`, href: "/inventory/" },
        { label: "Par level", value: `${s.par} ${s.unit}`, href: "/inventory/" },
        { label: "Daily usage", value: `${s.dailyUsage} ${s.unit}/day`, href: "/inventory/" },
        { label: "Unit cost", value: `${money(s.unitCost)}/${s.unit}`, href: "/inventory/" },
      ],
      status: "pending",
      proposedAt: new Date().toISOString(),
      confirmation: `Sent to ${s.supplier} via email. Delivery expected tomorrow before 10 AM.`,
      action: `Email purchase order to ${s.supplier}: ${q} ${s.unit} ${s.name.toLowerCase()}, deliver next morning.`,
    };
    addApproval(a);
    setDrafted((d) => ({ ...d, [s.itemId]: a.id }));
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Inventory" description={`${location?.name} · ${rows.length} tracked items${counted ? ` · counted ${dateTime(counted)}` : ""}`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Below par" loading={stock.loading} value={flagged.length} hint={`${flagged.filter((f) => stockStatus(f) === "critical").length} critical`} />
        <StatTile label="Stock on hand" loading={stock.loading} value={money(value)} hint="at cost" />
        <StatTile label="Under 2 days cover" loading={stock.loading} value={rows.filter((r) => daysOfCover(r) < 2).length} hint="items" />
        <StatTile label="Reorder cost" loading={stock.loading} value={money(flagged.reduce((a, f) => a + reorderCost(f), 0))} hint="to bring all to par" />
      </div>

      <Section title="Needs attention" description="Below par, most urgent first. Drafting a reorder sends it to Approvals." bodyClassName="px-0">
        {stock.loading ? (
          <div className="flex flex-col gap-2 px-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : flagged.length ? (
          <StockTable rows={flagged} renderAction={(s) => {
            const existing = existingApprovalFor(s) ?? (drafted[s.itemId] ? approvals.find((a) => a.id === drafted[s.itemId]) : undefined);
            return existing ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/approvals/">
                  <Check /> <span className="hidden sm:inline">Drafted</span>
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => draft(s)} aria-label={`Draft reorder for ${s.name}`}>
                <ClipboardList /> <span className="hidden sm:inline">Draft reorder</span>
                <span className="sm:hidden">Draft</span>
              </Button>
            );
          }} />
        ) : (
          <div className="px-4">
            <EmptyState title="Everything is at par" description="No item is below its par level." />
          </div>
        )}
      </Section>

      <Section title="All stock" description="Items at or above par." bodyClassName="px-0">
        {stock.loading ? <div className="flex flex-col gap-2 px-4">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10" />)}</div> : <StockTable rows={rest} />}
      </Section>
    </div>
  );
}

function StockTable({ rows, renderAction }: { rows: StockLevel[]; renderAction?: (s: StockLevel) => React.ReactNode }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">On hand</TableHead>
          <TableHead className="hidden text-right sm:table-cell">Par</TableHead>
          <TableHead className="text-right">Cover</TableHead>
          <TableHead className="hidden sm:table-cell">Status</TableHead>
          {renderAction ? <TableHead className="text-right"><span className="sr-only">Action</span></TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((s) => {
          const st = stockStatus(s);
          const cover = daysOfCover(s);
          return (
            <TableRow key={s.itemId}>
              <TableCell className="max-w-[150px] whitespace-normal sm:max-w-none">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium">{s.name}</span>
                  <Badge variant={STATUS[st].variant} className="sm:hidden">{STATUS[st].label}</Badge>
                </div>
                <div className="text-muted-foreground truncate text-xs">{s.category} · {s.supplier}</div>
              </TableCell>
              <TableCell className={cn("text-right", st === "critical" && "font-semibold text-red-700")}>
                {s.onHand} {s.unit}
                <div className="text-muted-foreground text-xs font-normal sm:hidden">par {s.par}</div>
              </TableCell>
              <TableCell className="text-muted-foreground hidden text-right sm:table-cell">{s.par}</TableCell>
              <TableCell className="text-right">{Number.isFinite(cover) ? `${one(cover)} d` : "—"}</TableCell>
              <TableCell className="hidden sm:table-cell"><Badge variant={STATUS[st].variant}>{STATUS[st].label}</Badge></TableCell>
              {renderAction ? <TableCell className="text-right">{renderAction(s)}</TableCell> : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
