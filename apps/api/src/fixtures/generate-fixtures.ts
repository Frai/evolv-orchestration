/**
 * Local-inspection convenience only — dumps the deterministic fixture set to JSON.
 * `npm run fixtures` regenerates /src/fixtures/data. Not part of build/dev/seed anymore;
 * the real data source is Supabase (see scripts/seed-supabase.ts, which shares the same
 * gen/build.ts pipeline).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aggregateSalesDays } from "@evolv/contracts/sales";
import { aggregateLabourDays } from "@evolv/contracts/labour";
import { buildFixtureSet } from "./gen/build";

const OUT = join(__dirname, "data");
const write = (name: string, data: unknown) => {
  writeFileSync(join(OUT, name), JSON.stringify(data));
  console.log(`  wrote ${name}`);
};

mkdirSync(OUT, { recursive: true });
const fx = buildFixtureSet();
console.log(`Generating fixtures: 90 days ending ${fx.meta.asOf} (today ${fx.meta.today})`);

write("meta.json", fx.meta);
write("locations.json", fx.locations);
write("sales.json", fx.sales);
write("menus.json", fx.menus);
write("item-sales.json", fx.itemSeries);
write("labour.json", fx.labour);
write("stock.json", fx.stock);
write("briefs.json", fx.briefs);
write("agents.json", fx.agents);
write("agent-runs.json", fx.runs);
write("approvals.json", fx.approvals);
write("integrations.json", fx.integrations);
write("qa.json", fx.qa);
write("deliveries.json", fx.deliveries);

const pt = aggregateSalesDays(fx.sales.filter((s) => s.locationId === "prairie-table"), "prairie-table").slice(-7);
console.log("\nPrairie Table, last 7 days:");
console.table(pt.map((d) => ({ date: d.date, net: d.netSales, covers: d.covers, orders: d.orders, dine_in: d.channels.dine_in, delivery: d.channels.delivery })));
for (const loc of fx.locations) {
  const sd = aggregateSalesDays(fx.sales.filter((s) => s.locationId === loc.id), loc.id);
  const ld = aggregateLabourDays(fx.labour.filter((l) => l.locationId === loc.id), loc.id);
  const sales = sd.reduce((a, d) => a + d.netSales, 0);
  const cost = ld.reduce((a, d) => a + d.labourCost, 0);
  console.log(`${loc.name.padEnd(24)} avg/day ${Math.round(sales / sd.length).toString().padStart(6)}  labour ${((cost / sales) * 100).toFixed(1)}%  below par ${fx.stock.filter((s) => s.locationId === loc.id && s.onHand < s.par).length}`);
}
