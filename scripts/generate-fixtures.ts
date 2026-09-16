/**
 * Seeded fixture generator. `npm run fixtures` regenerates /src/fixtures.
 * Produces 90 days of data ending yesterday for every tenant.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Alert, Brief, DeliveryReceipt, ItemSales, LabourDay, MenuItem, QAPair, SalesDay, StockLevel } from "@/core/types";
import { addDays, todayISO } from "@/core/dates";
import { buildBriefInput } from "@/core/brief";
import { detectAlerts } from "@/core/alerts";
import { aggregateSalesDays, deadItems, delta, findDay, itemTotals, sameWeekdayBaseline, topItems } from "@/core/sales";
import { aggregateLabourDays } from "@/core/labour";
import { Rng, hashSeed } from "./gen/rng";
import { LOCATIONS, SERIES, STOCK } from "./gen/world";
import { generateAllSales, planAnomalies, type ItemSeriesFixture } from "./gen/sales";
import { generateLabour, planLabour } from "./gen/labour";
import { composeBrief } from "./gen/briefs";
import { generateQA } from "./gen/qa";
import { AGENTS, generateRuns, localIso } from "./gen/agents";
import { hasSevenShifts, integrationsFor } from "./gen/integrations";

const OUT = join(process.cwd(), "src", "fixtures");
const DAYS = 90;
const BRIEF_DAYS = 14;

const today = process.env.FIXTURE_TODAY ?? todayISO();
const asOf = addDays(today, -1);
const dates = Array.from({ length: DAYS }, (_, i) => addDays(asOf, -(DAYS - 1 - i)));

const write = (name: string, data: unknown) => {
  writeFileSync(join(OUT, name), JSON.stringify(data));
  console.log(`  wrote ${name}`);
};

mkdirSync(OUT, { recursive: true });
console.log(`Generating fixtures: ${DAYS} days ending ${asOf} (today ${today})`);

// ---------------------------------------------------------------- sales + items
const seriesOut = generateAllSales(dates);
const anomalies = planAnomalies(dates);
const labourPlants = planLabour(dates);
const allSales: SalesDay[] = seriesOut.flatMap((s) => s.days);
const allItemSeries: ItemSeriesFixture[] = seriesOut.flatMap((s) => s.items);
const menus = SERIES.map((s) => ({ locationId: s.locationId, outletId: s.outletId, items: s.menu }));

// ---------------------------------------------------------------- labour
const allLabour: LabourDay[] = seriesOut.flatMap((s) => generateLabour(s, labourPlants));

// ---------------------------------------------------------------- stock
const countedAt = localIso(asOf, 23, 10);
const stock: StockLevel[] = [];
for (const loc of LOCATIONS) {
  const rng = new Rng(hashSeed(`stock:${loc.id}`));
  const rows = STOCK[loc.id as keyof typeof STOCK];
  for (const r of rows) {
    const ratio = r.plantedRatio ?? rng.range(1.3, 2.3);
    const raw = r.par * ratio;
    const onHand = r.par >= 100 ? Math.round(raw / 10) * 10 : r.par >= 20 ? Math.round(raw) : Math.round(raw * 2) / 2;
    const { plantedRatio, ...rest } = r;
    void plantedRatio;
    stock.push({ ...rest, onHand, countedAt });
  }
}

// ---------------------------------------------------------------- per-location derived data
const briefs: Brief[] = [];
const qa: QAPair[] = [];
const runs = [];
const approvals = [];
const deliveries: DeliveryReceipt[] = [];
const integrations = [];

const expandItems = (series: ItemSeriesFixture[], menu: Map<string, MenuItem>): ItemSales[] => {
  const rows: ItemSales[] = [];
  for (const s of series) {
    const m = menu.get(s.itemId)!;
    s.qty.forEach((q, i) => {
      if (!q) return;
      rows.push({ locationId: s.locationId, outletId: s.outletId, date: dates[i], itemId: s.itemId, name: m.name, category: m.category, qty: q, netSales: Math.round(q * m.price * 100) / 100 });
    });
  }
  return rows;
};

for (const loc of LOCATIONS) {
  const locSeries = seriesOut.filter((s) => s.cfg.locationId === loc.id);
  const salesDays = aggregateSalesDays(locSeries.flatMap((s) => s.days), loc.id);
  const labourDays = aggregateLabourDays(allLabour.filter((l) => l.locationId === loc.id), loc.id);
  const menu = new Map<string, MenuItem>(locSeries.flatMap((s) => s.cfg.menu).map((m) => [m.id, m]));
  const itemSales = expandItems(allItemSeries.filter((s) => s.locationId === loc.id), menu);
  const locStock = stock.filter((s) => s.locationId === loc.id);
  const menuList = [...menu.values()];

  const totals30 = itemTotals(itemSales, { from: addDays(asOf, -29), to: asOf }, menu);
  const dead = deadItems(totals30);
  const top = topItems(totals30, 10);

  // Alerts for each of the last 30 days (needed for run traces and briefs).
  const alertsByDate = new Map<string, Alert[]>();
  for (const date of dates.slice(-30)) {
    alertsByDate.set(
      date,
      detectAlerts({ location: loc, date, salesDays, labourDays, stock: date === asOf ? locStock : [], itemSales, menu: menuList }),
    );
  }

  const channel = "whatsapp" as const;
  const channelLabel = "WhatsApp";
  const recipients = [loc.owner.phone];

  // Briefs for the last 14 days.
  dates.slice(-BRIEF_DAYS).forEach((date, idx) => {
    const input = buildBriefInput(loc, date, salesDays, labourDays);
    if (!input) return;
    const dayTotals = itemTotals(itemSales, { from: date, to: date }, menu);
    const outletTotals =
      loc.type === "hotel"
        ? locSeries.map((s) => {
            const d = findDay(s.days, date)!;
            const base = sameWeekdayBaseline(s.days, date);
            return { name: s.cfg.label, netSales: d.netSales, delta: delta(d.netSales, base) };
          })
        : undefined;
    briefs.push(
      composeBrief(
        {
          location: loc,
          input,
          salesDays,
          labourDay: labourDays.find((l) => l.date === date),
          outletTotals,
          topItem: topItems(dayTotals, 1)[0],
          deadItems: dead,
          stock: date === asOf ? locStock : undefined,
          variant: idx,
          isLatest: date === asOf,
        },
        channel,
        localIso(addDays(date, 1), 6, 0, 4 + idx),
      ),
    );
  });

  // Runs + approvals.
  const r = generateRuns({
    location: loc,
    dates,
    asOf,
    salesDays,
    labourDays,
    stock: locStock,
    alertsByDate,
    deadItems: dead,
    overstaffedTuesdays: labourPlants.overstaffedTuesdays,
    recipients,
    channelLabel,
    sevenShifts: hasSevenShifts(loc.id),
  });
  runs.push(...r.runs);
  approvals.push(...r.approvals);

  // Q&A
  const outletTotals =
    loc.type === "hotel"
      ? locSeries.map((s) => {
          const d = findDay(s.days, asOf)!;
          return { name: s.cfg.label, netSales: d.netSales, delta: delta(d.netSales, sameWeekdayBaseline(s.days, asOf)) };
        })
      : undefined;
  qa.push(
    ...generateQA({
      location: loc,
      asOf,
      salesDays,
      labourDays,
      stock: locStock,
      deadItems: dead,
      topItems: top,
      badSaturday: anomalies.badSaturday,
      spike: anomalies.spike,
      outletTotals,
    }),
  );

  deliveries.push({ channel, sentAt: localIso(today, 6, 0, 4), to: recipients });
  integrations.push({ locationId: loc.id, integrations: integrationsFor(loc, localIso(today, 6, 2, 11)) });
}

// ---------------------------------------------------------------- write
write("meta.json", { generatedAt: new Date().toISOString(), today, asOf, dates, anomalies, labourPlants });
write("locations.json", LOCATIONS);
write("sales.json", allSales);
write("menus.json", menus);
write("item-sales.json", allItemSeries);
write("labour.json", allLabour);
write("stock.json", stock);
write("briefs.json", briefs);
write("agents.json", AGENTS);
write("agent-runs.json", runs);
write("approvals.json", approvals);
write("integrations.json", integrations);
write("qa.json", qa);
write("deliveries.json", LOCATIONS.map((l, i) => ({ locationId: l.id, ...deliveries[i] })));

// ---------------------------------------------------------------- checkpoint print
const pt = aggregateSalesDays(seriesOut.filter((s) => s.cfg.locationId === "prairie-table").flatMap((s) => s.days), "prairie-table").slice(-7);
console.log("\nPrairie Table, last 7 days:");
console.table(pt.map((d) => ({ date: d.date, net: d.netSales, covers: d.covers, orders: d.orders, dine_in: d.channels.dine_in, delivery: d.channels.delivery })));
for (const loc of LOCATIONS) {
  const sd = aggregateSalesDays(allSales.filter((s) => s.locationId === loc.id), loc.id);
  const ld = aggregateLabourDays(allLabour.filter((l) => l.locationId === loc.id), loc.id);
  const sales = sd.reduce((a, d) => a + d.netSales, 0);
  const cost = ld.reduce((a, d) => a + d.labourCost, 0);
  console.log(`${loc.name.padEnd(24)} avg/day ${Math.round(sales / sd.length).toString().padStart(6)}  labour ${((cost / sales) * 100).toFixed(1)}%  below par ${stock.filter((s) => s.locationId === loc.id && s.onHand < s.par).length}`);
}
