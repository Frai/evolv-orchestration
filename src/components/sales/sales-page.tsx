"use client";
import { useState } from "react";
import { adapters } from "@/adapters";
import { useAppState } from "@/components/providers/app-state";
import { useAsync } from "@/hooks/use-async";
import { rangeEndingAt } from "@/core/dates";
import { deadItems, hourlyHeatmap, itemTotals, sumBy, topItems } from "@/core/sales";
import { int, money, one, pct, signedPct } from "@/core/format";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/common/section";
import { StatTile } from "@/components/common/stat-tile";
import { Delta } from "@/components/common/delta";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SalesLine } from "@/components/charts/sales-line";
import { HourHeatmap } from "@/components/charts/hour-heatmap";
import { ChannelBars } from "@/components/charts/channel-bars";

type Window = 7 | 30 | 90;

export function SalesPage() {
  const { locationId, outletId, asOf, location } = useAppState();
  const [win, setWin] = useState<Window>(30);
  const range = rangeEndingAt(asOf, win);

  const sales = useAsync(() => adapters.sales.getSalesDays({ locationId, outletId, range }), [locationId, outletId, asOf, win]);
  const items = useAsync(async () => {
    const [rows, menu] = await Promise.all([adapters.sales.getItemSales({ locationId, outletId, range }), adapters.sales.getMenu(locationId, outletId)]);
    const totals = itemTotals(rows, range, new Map(menu.map((m) => [m.id, m])));
    return { top: topItems(totals, 10), dead: deadItems(totals), totals };
  }, [locationId, outletId, asOf, win]);

  const days = sales.data ?? [];
  const total = sumBy(days, (d) => d.netSales);
  const lastYear = sumBy(days, (d) => d.lastYearNetSales);
  const covers = sumBy(days, (d) => d.covers);
  const avgCheck = covers ? total / covers : 0;
  const delivery = sumBy(days, (d) => d.channels.delivery + d.channels.room_service);
  const grid = days.length ? hourlyHeatmap(days) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Sales" description={`${location?.name}${outletId ? ` · ${location?.outlets?.find((o) => o.id === outletId)?.name}` : ""}, last ${win} days to ${asOf}`}>
        <Tabs value={String(win)} onValueChange={(v) => setWin(Number(v) as Window)}>
          <TabsList aria-label="Window">
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
            <TabsTrigger value="90">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Net sales" loading={sales.loading} value={money(total)} delta={<Delta value={lastYear ? (total - lastYear) / lastYear : null} />} hint="vs last year" />
        <StatTile label="Daily average" loading={sales.loading} value={money(days.length ? total / days.length : 0)} hint={`${days.length} days`} />
        <StatTile label="Covers" loading={sales.loading} value={int(covers)} hint={`${money(avgCheck)} avg check`} />
        <StatTile label={location?.type === "hotel" ? "Room service share" : "Delivery share"} loading={sales.loading} value={pct(total ? delivery / total : 0, 0)} hint={money(delivery)} />
      </div>

      <Section title="Net sales" description="Daily net sales with the same weekday last year as a ghost line.">
        {sales.loading ? <Skeleton className="h-60" /> : days.length ? <SalesLine days={days} /> : <EmptyState title="No sales in this window" />}
        <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="bg-chart-1 h-0.5 w-4 rounded" /> This year</span>
          <span className="inline-flex items-center gap-1.5"><span className="bg-chart-ghost h-0.5 w-4 rounded" /> Last year</span>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Sales by hour" description="Average net sales for each hour, by day of the week.">
          {sales.loading || !grid ? <Skeleton className="h-56" /> : <HourHeatmap grid={grid} />}
        </Section>
        <Section title="Channel split" description={win === 90 ? "Weekly totals by channel." : "Daily totals by channel."}>
          {sales.loading ? <Skeleton className="h-60" /> : days.length ? <ChannelBars days={days} /> : <EmptyState title="No sales in this window" />}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top 10 items" description="By net sales in the window." bodyClassName="px-0">
          {items.loading ? (
            <div className="flex flex-col gap-2 px-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.data?.top.map((t, i) => (
                  <TableRow key={t.id}>
                    <TableCell className="max-w-[180px] truncate">
                      <span className="text-muted-foreground tnum mr-2 inline-block w-4 text-xs">{i + 1}</span>
                      {t.name}
                      <span className="text-muted-foreground ml-1.5 hidden text-xs sm:inline">{t.category}</span>
                    </TableCell>
                    <TableCell className="text-right">{int(t.qty)}</TableCell>
                    <TableCell className="text-right font-medium">{money(t.netSales)}</TableCell>
                    <TableCell className="hidden text-right sm:table-cell">{pct(total ? t.netSales / total : 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
        <Section title="Dead items" description="Selling fewer than 2 a week in this window." bodyClassName="px-0">
          {items.loading ? (
            <div className="flex flex-col gap-2 px-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : items.data?.dead.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Per week</TableHead>
                  <TableHead className="text-right">Net sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.data.dead.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <span>{t.name}</span>
                        <Badge variant="warning">Consider removing</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{int(t.qty)}</TableCell>
                    <TableCell className="text-right">{one(t.perWeek)}</TableCell>
                    <TableCell className="text-right">{money(t.netSales)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="px-4">
              <EmptyState title="No dead items" description="Every item on the menu sold at least twice a week in this window." />
            </div>
          )}
        </Section>
      </div>
      {days.length ? (
        <p className="text-muted-foreground text-xs">
          Best day: {days.reduce((a, d) => (d.netSales > a.netSales ? d : a)).date} ({money(Math.max(...days.map((d) => d.netSales)))}). Worst day: {days.reduce((a, d) => (d.netSales < a.netSales ? d : a)).date} ({money(Math.min(...days.map((d) => d.netSales)))}). Year over year {signedPct(lastYear ? (total - lastYear) / lastYear : 0, 0)}.
        </p>
      ) : null}
    </div>
  );
}
