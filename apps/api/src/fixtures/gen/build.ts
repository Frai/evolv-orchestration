/**
 * Seeded fixture generator, extracted so both the JSON writer (generate-fixtures.ts,
 * kept as a local-inspection convenience) and the Supabase seed script
 * (scripts/seed-supabase.ts) can produce the exact same deterministic dataset.
 */
import type {
  Agent,
  AgentRun,
  Alert,
  Approval,
  Brief,
  DeliveryReceipt,
  Integration,
  ItemSales,
  LabourDay,
  Location,
  MenuItem,
  QAPair,
  SalesDay,
  StockLevel,
} from "@evolv/contracts/types";
import { addDays, todayISO } from "@evolv/contracts/dates";
import { buildBriefInput } from "@evolv/contracts/brief";
import { detectAlerts } from "@evolv/contracts/alerts";
import { aggregateSalesDays, deadItems, delta, findDay, itemTotals, sameWeekdayBaseline, topItems } from "@evolv/contracts/sales";
import { aggregateLabourDays } from "@evolv/contracts/labour";
import { Rng, hashSeed } from "./rng";
import { LOCATIONS, SERIES, STOCK } from "./world";
import { generateAllSales, planAnomalies, type ItemSeriesFixture } from "./sales";
import { generateLabour, planLabour } from "./labour";
import { composeBrief } from "./briefs";
import { generateQA } from "./qa";
import { AGENTS, generateRuns, localIso } from "./agents";
import { hasSevenShifts, integrationsFor } from "./integrations";

const DAYS = 90;
const BRIEF_DAYS = 14;

export interface MenuFixture {
  locationId: string;
  outletId?: string;
  items: MenuItem[];
}

export interface DeliveryFixture {
  locationId: string;
  channel: DeliveryReceipt["channel"];
  sentAt: string;
  to: string[];
}

export interface IntegrationFixture {
  locationId: string;
  integrations: Integration[];
}

export interface FixtureSet {
  meta: { generatedAt: string; today: string; asOf: string; dates: string[] };
  locations: Location[];
  sales: SalesDay[];
  menus: MenuFixture[];
  itemSeries: ItemSeriesFixture[];
  labour: LabourDay[];
  stock: StockLevel[];
  briefs: Brief[];
  agents: Agent[];
  runs: AgentRun[];
  approvals: Approval[];
  integrations: IntegrationFixture[];
  qa: QAPair[];
  deliveries: DeliveryFixture[];
}

export function buildFixtureSet(): FixtureSet {
  const today = process.env.FIXTURE_TODAY ?? todayISO();
  const asOf = addDays(today, -1);
  const dates = Array.from({ length: DAYS }, (_, i) => addDays(asOf, -(DAYS - 1 - i)));

  const seriesOut = generateAllSales(dates);
  const anomalies = planAnomalies(dates);
  const labourPlants = planLabour(dates);
  const allSales: SalesDay[] = seriesOut.flatMap((s) => s.days);
  const allItemSeries: ItemSeriesFixture[] = seriesOut.flatMap((s) => s.items);
  const menus = SERIES.map((s) => ({ locationId: s.locationId, outletId: s.outletId, items: s.menu }));

  const allLabour: LabourDay[] = seriesOut.flatMap((s) => generateLabour(s, labourPlants));

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

  const briefs: Brief[] = [];
  const qa: QAPair[] = [];
  const runs: AgentRun[] = [];
  const approvals: Approval[] = [];
  const deliveries: DeliveryReceipt[] = [];
  const integrations: Integration[][] = [];

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
    integrations.push(integrationsFor(loc, localIso(today, 6, 2, 11)));
  }

  return {
    meta: { generatedAt: new Date().toISOString(), today, asOf, dates },
    locations: LOCATIONS,
    sales: allSales,
    menus,
    itemSeries: allItemSeries,
    labour: allLabour,
    stock,
    briefs,
    agents: AGENTS,
    runs,
    approvals,
    integrations: LOCATIONS.map((l, i) => ({ locationId: l.id, integrations: integrations[i] })),
    qa,
    deliveries: LOCATIONS.map((l, i) => ({ locationId: l.id, ...deliveries[i] })),
  };
}
